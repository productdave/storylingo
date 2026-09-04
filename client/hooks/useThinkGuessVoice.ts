import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import type { VoiceState } from "@shared/thinkGuess";

type Options = {
  roundId: string | null;
  onTranscript: (transcript: string, confidence?: number) => void;
  onError: (message: string) => void;
};

export function useThinkGuessVoice({
  roundId,
  onTranscript,
  onError,
}: Options) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  const disconnect = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    audioRef.current = null;
    setIsConnected(false);
    setVoiceState("idle");
  }, []);

  useEffect(() => disconnect, [disconnect]);

  const speak = useCallback((text: string) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") {
      // Text-only controls (for example, "Give me a clue") also work before
      // the child starts a Realtime voice session. Return the UI to its idle
      // state after the generated reply arrives instead of leaving the
      // game stuck in its temporary thinking state.
      setVoiceState("idle");
      return;
    }
    setVoiceState("ai_speaking");
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generated Think & Guess reply. Speak it exactly as written: ${JSON.stringify(text)}`,
            },
          ],
        },
      }),
    );
    channel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            "Speak the supplied generated Think & Guess reply exactly without adding or changing words. Use a relaxed conversational pace for a child age 4–7. Sound warm, curious, and gently delighted, never rushed, sing-song, babyish, or like a game-show host. Pause naturally between sentences.",
        },
      }),
    );
  }, []);

  const connect = useCallback(
    async (opening: string) => {
      if (!roundId) return;
      if (Platform.OS !== "web") {
        onError("Voice play is available in a web browser for this pilot.");
        return;
      }
      try {
        setVoiceState("connecting");
        const tokenUrl = new URL(
          `/api/think-guess/rounds/${roundId}/realtime-token`,
          getApiUrl(),
        );
        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!tokenResponse.ok)
          throw new Error("Voice could not start. Please try again.");
        const { client_secret } = (await tokenResponse.json()) as {
          client_secret: string;
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        streamRef.current = stream;
        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = isMuted;
        audioRef.current = audio;
        peer.ontrack = (event) => {
          audio.srcObject = event.streams[0];
        };

        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;
        channel.onopen = () => {
          setIsConnected(true);
          setVoiceState("child_turn");
          speak(opening);
        };
        channel.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (
              data.type ===
              "conversation.item.input_audio_transcription.completed"
            ) {
              const transcript = data.transcript?.trim();
              if (transcript) onTranscript(transcript, data.confidence);
            } else if (
              data.type === "response.audio.delta" ||
              data.type === "response.audio_transcript.delta"
            ) {
              setVoiceState("ai_speaking");
            } else if (data.type === "response.done") {
              setVoiceState("child_turn");
            } else if (data.type === "error") {
              onError("The voice connection had a problem. Please try again.");
              setVoiceState("error");
            }
          } catch {
            // Ignore non-JSON transport messages.
          }
        };
        channel.onerror = () => {
          setVoiceState("error");
          onError("The voice connection had a problem. Please try again.");
        };
        peer.onconnectionstatechange = () => {
          if (
            peer.connectionState === "failed" ||
            peer.connectionState === "disconnected"
          ) {
            setVoiceState("error");
            setIsConnected(false);
            onError("The voice connection was lost. Please reconnect.");
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const sdpResponse = await fetch(
          "https://api.openai.com/v1/realtime/calls",
          {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: `Bearer ${client_secret}`,
              "Content-Type": "application/sdp",
            },
          },
        );
        if (!sdpResponse.ok)
          throw new Error("Voice could not connect. Please try again.");
        await peer.setRemoteDescription({
          type: "answer",
          sdp: await sdpResponse.text(),
        });
      } catch (error) {
        disconnect();
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser settings and try again."
            : error instanceof Error
              ? error.message
              : "Voice could not start. Please try again.";
        setVoiceState("error");
        onError(message);
      }
    },
    [disconnect, isMuted, onError, onTranscript, roundId, speak],
  );

  const startTalking = useCallback(() => {
    if (!isConnected || voiceState === "ai_speaking") return;
    channelRef.current?.send(
      JSON.stringify({ type: "input_audio_buffer.clear" }),
    );
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setVoiceState("child_speaking");
  }, [isConnected, voiceState]);

  const stopTalking = useCallback(() => {
    if (voiceState !== "child_speaking") return;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    channelRef.current?.send(
      JSON.stringify({ type: "input_audio_buffer.commit" }),
    );
    setVoiceState("ai_thinking");
  }, [voiceState]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  return {
    voiceState,
    isMuted,
    isConnected,
    connect,
    disconnect,
    speak,
    startTalking,
    stopTalking,
    toggleMute,
    setVoiceState,
  };
}
