# Story Buddy - Design Guidelines

## 1. Brand Identity

**Purpose**: A voice-first interactive storyteller that brings classic fairy tales to life for children ages 3-10, making them active participants in timeless stories.

**Aesthetic Direction**: **Storybook Magical** - Soft, whimsical, and inviting. Think bedtime story warmth meets gentle adventure. The app should feel like opening a cherished illustrated children's book, not a generic tech product.

**Memorable Element**: Oversized, tactile buttons with playful illustrations that children instinctively want to press. The Talk button should feel like a magical portal that activates when touched.

## 2. Navigation Architecture

**Root Navigation**: Stack-Only (linear flow appropriate for young users)

**Screen Flow**:
1. Home → Story Selection → Session (active story) → End/Restart
2. No tab bar or complex navigation - keep it simple and linear

## 3. Screen-by-Screen Specifications

### Home Screen
**Purpose**: Welcome entry point

**Layout**:
- Header: None (full-screen welcome)
- Content: Vertically centered
  - Large app icon/mascot illustration (friendly character)
  - "Story Buddy" title in playful display font
  - Single large "Start" button
- Safe area insets: top: insets.top + 60, bottom: insets.bottom + 60

**Components**:
- Rounded rectangular button (minimum 200pt wide × 70pt tall for small hands)
- Gentle background gradient (sky to cloud)

### Story Selection Screen
**Purpose**: Choose which fairy tale to experience

**Layout**:
- Header: Transparent, title "Choose Your Story", no back button (one-way flow)
- Content: Scrollable vertical list
  - 3 large story cards (Snow White, Rapunzel, Peter Pan)
  - Each card shows: illustration + story title + 1-line description
- Safe area insets: top: headerHeight + 24, bottom: insets.bottom + 24

**Components**:
- Story cards: 90% screen width, 160pt tall, rounded corners (20pt radius)
- Cards have subtle shadow and scale slightly on press
- Generous spacing between cards (24pt)

### Session Screen
**Purpose**: Active storytelling interaction

**Layout**:
- Header: Transparent, title = story name, left button "Stop" (confirmation alert)
- Content: Non-scrollable, vertically centered
  - Status text at top (small, subtle)
  - Large circular Talk button (center, dominant)
  - Small "Start Again" button below Talk button
- Safe area insets: top: headerHeight + 40, bottom: insets.bottom + 40

**Components**:
- Talk button: 180pt diameter circle, press-and-hold interaction
  - Idle state: solid primary color
  - Pressed state: glowing animation, scale 1.05
  - Speaking state: pulsing animation
- Status text: 14pt, centered, color: Text.secondary
- Start Again: 48pt tall, outline style button

### End Screen (optional modal)
**Purpose**: Story completion celebration

**Layout**:
- Native modal presentation
- Content: Centered
  - Completion illustration
  - "The End!" text
  - Story recap (2-3 lines)
  - Two buttons: "New Story" / "Finish"
- Padding: 32pt all sides

## 4. Color Palette

**Primary**: #FF6B9D (warm pink - friendly, inviting, gender-neutral for kids)
**Secondary**: #FFD93D (sunny yellow - joyful accent)
**Background**: #F8F5FF (soft lavender tint - magical, dreamy)
**Surface**: #FFFFFF (pure white for cards)
**Text Primary**: #2D1B4E (deep purple - readable, storybook feel)
**Text Secondary**: #7E6BA3 (muted purple)
**Success**: #6BCF7F (soft green)
**Border**: #E5D9F2 (light lavender)

## 5. Typography

**Display Font**: "Fredoka One" (Google Font) - Rounded, playful, perfect for kids
- Story titles: 32pt Bold
- Button labels: 20pt Bold

**Body Font**: SF Pro (System) - Legible for smaller text
- Status text: 14pt Regular
- Descriptions: 16pt Regular

## 6. Visual Design

**Touch Feedback**:
- All buttons scale to 0.95 on press
- Talk button has custom press animation (glow effect)
- Haptic feedback on all interactions

**Button Styles**:
- Primary buttons: solid fill, 16pt corner radius, no shadow
- Talk button (floating): subtle shadow (width: 0, height: 2, opacity: 0.10, radius: 2)
- Outline buttons: 2pt border, transparent fill

**Icons**: Use SF Symbols or Feather icons - never emojis

## 7. Assets to Generate

**REQUIRED**:
1. **icon.png** - App icon: Friendly mascot character (owl/bear reading book), warm colors
2. **splash-icon.png** - Same mascot, simplified for splash screen
3. **home-mascot.png** - Full mascot illustration for home screen welcome
4. **snow-white.png** - Story card illustration (apple, mirror, cottage)
5. **rapunzel.png** - Story card illustration (tower, long braid, window)
6. **peter-pan.png** - Story card illustration (ship, stars, silhouette flying)
7. **story-complete.png** - Celebration illustration (stars, sparkles, book closing)

**Style**: Soft watercolor illustrations, warm colors, minimal detail, safe and age-appropriate

**WHERE USED**:
- icon.png: Device home screen
- splash-icon.png: App launch screen
- home-mascot.png: Home screen, centered above title
- snow-white.png: Story Selection screen card
- rapunzel.png: Story Selection screen card
- peter-pan.png: Story Selection screen card
- story-complete.png: End screen modal