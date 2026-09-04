import {
  answerObjectSchema,
  type AnswerAttribute,
  type AnswerObject,
  type ThinkGuessLanguage,
} from "@shared/thinkGuess";

type Seed = {
  id: string;
  category: AnswerObject["category"];
  difficulty: number;
  attributes: Partial<Record<AnswerAttribute, boolean>>;
  en: [string, string[], string[]];
  zh: [string, string[], string[]];
  es: [string, string[], string[]];
  stories?: string[];
};

const seeds: Seed[] = [
  {
    id: "animal_elephant",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      has_trunk: true,
      flies: false,
    },
    en: [
      "elephant",
      ["elephant", "an elephant"],
      [
        "It is very big.",
        "It has four legs.",
        "It has big ears.",
        "It has a long trunk.",
      ],
    ],
    zh: [
      "大象",
      ["大象", "一只大象"],
      ["它很大。", "它有四条腿。", "它有大耳朵。", "它有长鼻子。"],
    ],
    es: [
      "elefante",
      ["elefante", "un elefante"],
      [
        "Es muy grande.",
        "Tiene cuatro patas.",
        "Tiene orejas grandes.",
        "Tiene una trompa larga.",
      ],
    ],
  },
  {
    id: "animal_lion",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      flies: false,
      has_wings: false,
    },
    en: [
      "lion",
      ["lion", "a lion"],
      [
        "It is a big animal.",
        "It has four legs.",
        "It has a loud roar.",
        "The male has a mane.",
      ],
    ],
    zh: [
      "狮子",
      ["狮子", "一只狮子"],
      ["它是一种大型动物。", "它有四条腿。", "它会大声吼叫。", "雄狮有鬃毛。"],
    ],
    es: [
      "león",
      ["león", "un león"],
      [
        "Es un animal grande.",
        "Tiene cuatro patas.",
        "Ruge muy fuerte.",
        "El macho tiene melena.",
      ],
    ],
  },
  {
    id: "animal_giraffe",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      flies: false,
      has_wings: false,
    },
    en: [
      "giraffe",
      ["giraffe", "a giraffe"],
      [
        "It is a tall animal.",
        "It has four legs.",
        "It has brown patches.",
        "Its neck is very long.",
      ],
    ],
    zh: [
      "长颈鹿",
      ["长颈鹿", "一只长颈鹿"],
      [
        "它是一种很高的动物。",
        "它有四条腿。",
        "它身上有棕色斑块。",
        "它的脖子很长。",
      ],
    ],
    es: [
      "jirafa",
      ["jirafa", "una jirafa"],
      [
        "Es un animal alto.",
        "Tiene cuatro patas.",
        "Tiene manchas marrones.",
        "Su cuello es muy largo.",
      ],
    ],
  },
  {
    id: "animal_penguin",
    category: "animal",
    difficulty: 2,
    attributes: {
      alive: true,
      animal: true,
      small: true,
      swims: true,
      has_wings: true,
      flies: false,
    },
    en: [
      "penguin",
      ["penguin", "a penguin"],
      [
        "It is a bird.",
        "It is black and white.",
        "It swims very well.",
        "It has wings but cannot fly.",
      ],
    ],
    zh: [
      "企鹅",
      ["企鹅", "一只企鹅"],
      [
        "它是一种鸟。",
        "它是黑白相间的。",
        "它很会游泳。",
        "它有翅膀但不会飞。",
      ],
    ],
    es: [
      "pingüino",
      ["pingüino", "un pingüino"],
      [
        "Es un ave.",
        "Es blanco y negro.",
        "Nada muy bien.",
        "Tiene alas pero no vuela.",
      ],
    ],
  },
  {
    id: "animal_butterfly",
    category: "animal",
    difficulty: 2,
    attributes: {
      alive: true,
      animal: true,
      small: true,
      flies: true,
      has_wings: true,
      four_legs: false,
    },
    en: [
      "butterfly",
      ["butterfly", "a butterfly"],
      [
        "It is small.",
        "It can fly.",
        "It has colourful wings.",
        "It begins life as a caterpillar.",
      ],
    ],
    zh: [
      "蝴蝶",
      ["蝴蝶", "一只蝴蝶"],
      ["它很小。", "它会飞。", "它有彩色的翅膀。", "它小时候是毛毛虫。"],
    ],
    es: [
      "mariposa",
      ["mariposa", "una mariposa"],
      [
        "Es pequeña.",
        "Puede volar.",
        "Tiene alas de colores.",
        "Empieza su vida como oruga.",
      ],
    ],
  },
  {
    id: "food_apple",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      red: true,
      round: true,
      crunchy: true,
    },
    en: [
      "apple",
      ["apple", "an apple"],
      [
        "You can eat it.",
        "It grows on a tree.",
        "It can be red or green.",
        "It is round and crunchy.",
      ],
    ],
    zh: [
      "苹果",
      ["苹果", "一个苹果"],
      ["它可以吃。", "它长在树上。", "它可以是红色或绿色。", "它又圆又脆。"],
    ],
    es: [
      "manzana",
      ["manzana", "una manzana"],
      [
        "Se puede comer.",
        "Crece en un árbol.",
        "Puede ser roja o verde.",
        "Es redonda y crujiente.",
      ],
    ],
    stories: ["snow-white"],
  },
  {
    id: "food_banana",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      yellow: true,
      round: false,
      soft: true,
    },
    en: [
      "banana",
      ["banana", "a banana"],
      [
        "It is a fruit.",
        "It is soft inside.",
        "It is usually yellow.",
        "Monkeys are famous for liking it.",
      ],
    ],
    zh: [
      "香蕉",
      ["香蕉", "一根香蕉"],
      [
        "它是一种水果。",
        "里面是软的。",
        "它通常是黄色的。",
        "猴子常被说成喜欢吃它。",
      ],
    ],
    es: [
      "plátano",
      ["plátano", "banana", "un plátano"],
      [
        "Es una fruta.",
        "Es blando por dentro.",
        "Normalmente es amarillo.",
        "A los monos les gusta mucho.",
      ],
    ],
  },
  {
    id: "food_carrot",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      orange: true,
      round: false,
      crunchy: true,
    },
    en: [
      "carrot",
      ["carrot", "a carrot"],
      [
        "It is a vegetable.",
        "It grows underground.",
        "It is orange and crunchy.",
        "Rabbits are famous for eating it.",
      ],
    ],
    zh: [
      "胡萝卜",
      ["胡萝卜", "一根胡萝卜"],
      [
        "它是一种蔬菜。",
        "它长在地下。",
        "它是橙色而且很脆。",
        "兔子常被说成喜欢吃它。",
      ],
    ],
    es: [
      "zanahoria",
      ["zanahoria", "una zanahoria"],
      [
        "Es una verdura.",
        "Crece bajo tierra.",
        "Es naranja y crujiente.",
        "A los conejos les gusta comerla.",
      ],
    ],
  },
  {
    id: "food_strawberry",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      red: true,
      round: false,
      soft: true,
    },
    en: [
      "strawberry",
      ["strawberry", "a strawberry"],
      [
        "It is a fruit.",
        "It is small and sweet.",
        "It is red with tiny seeds outside.",
        "It has green leaves on top.",
      ],
    ],
    zh: [
      "草莓",
      ["草莓", "一颗草莓"],
      [
        "它是一种水果。",
        "它又小又甜。",
        "它是红色的，籽在外面。",
        "它顶部有绿色叶子。",
      ],
    ],
    es: [
      "fresa",
      ["fresa", "una fresa"],
      [
        "Es una fruta.",
        "Es pequeña y dulce.",
        "Es roja con semillas por fuera.",
        "Tiene hojas verdes arriba.",
      ],
    ],
  },
  {
    id: "food_pizza",
    category: "food",
    difficulty: 2,
    attributes: {
      alive: false,
      edible: true,
      big: true,
      round: true,
      soft: true,
      crunchy: false,
    },
    en: [
      "pizza",
      ["pizza", "a pizza"],
      [
        "It is food.",
        "It is often round.",
        "It has cheese on top.",
        "It is cut into triangle slices.",
      ],
    ],
    zh: [
      "披萨",
      ["披萨", "一个披萨", "比萨"],
      [
        "它是一种食物。",
        "它通常是圆的。",
        "上面有奶酪。",
        "它会被切成三角形。",
      ],
    ],
    es: [
      "pizza",
      ["pizza", "una pizza"],
      [
        "Es comida.",
        "Suele ser redonda.",
        "Tiene queso encima.",
        "Se corta en trozos triangulares.",
      ],
    ],
  },
  {
    id: "toy_teddy_bear",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      soft: true,
      animal: false,
      used_at_home: true,
      four_legs: false,
    },
    en: [
      "teddy bear",
      ["teddy bear", "a teddy bear", "toy bear"],
      [
        "It is a toy.",
        "It is soft.",
        "You can cuddle it.",
        "It looks like a bear.",
      ],
    ],
    zh: [
      "泰迪熊",
      ["泰迪熊", "玩具熊", "一只玩具熊"],
      ["它是一个玩具。", "它很柔软。", "你可以抱着它。", "它看起来像一只熊。"],
    ],
    es: [
      "osito de peluche",
      ["osito de peluche", "oso de peluche", "un osito de peluche"],
      ["Es un juguete.", "Es suave.", "Puedes abrazarlo.", "Parece un oso."],
    ],
  },
  {
    id: "toy_ball",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      round: true,
      soft: false,
      used_at_home: true,
      has_wheels: false,
    },
    en: [
      "ball",
      ["ball", "a ball"],
      [
        "You play with it.",
        "It can bounce.",
        "You can throw or kick it.",
        "It is round.",
      ],
    ],
    zh: [
      "球",
      ["球", "一个球"],
      ["你可以用它玩。", "它可以弹起来。", "你可以扔它或踢它。", "它是圆的。"],
    ],
    es: [
      "pelota",
      ["pelota", "balón", "una pelota"],
      [
        "Juegas con ella.",
        "Puede rebotar.",
        "Puedes lanzarla o patearla.",
        "Es redonda.",
      ],
    ],
  },
  {
    id: "toy_kite",
    category: "toy",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      flies: true,
      has_wings: false,
      used_at_home: false,
      soft: false,
    },
    en: [
      "kite",
      ["kite", "a kite"],
      [
        "It is a toy.",
        "You use it outside.",
        "A string keeps it with you.",
        "The wind makes it fly.",
      ],
    ],
    zh: [
      "风筝",
      ["风筝", "一个风筝"],
      ["它是一个玩具。", "你在户外玩它。", "你用线牵着它。", "风让它飞起来。"],
    ],
    es: [
      "cometa",
      ["cometa", "una cometa"],
      [
        "Es un juguete.",
        "Se usa afuera.",
        "Una cuerda la mantiene contigo.",
        "El viento la hace volar.",
      ],
    ],
  },
  {
    id: "toy_blocks",
    category: "toy",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      round: false,
      soft: false,
      used_at_home: true,
      has_wheels: false,
    },
    en: [
      "building blocks",
      ["building blocks", "blocks", "toy blocks"],
      [
        "They are toys.",
        "They come in many colours.",
        "You stack them.",
        "You can build towers with them.",
      ],
    ],
    zh: [
      "积木",
      ["积木", "玩具积木"],
      [
        "它们是玩具。",
        "它们有很多颜色。",
        "你可以把它们叠起来。",
        "你可以用它们搭高塔。",
      ],
    ],
    es: [
      "bloques",
      ["bloques", "bloques de construcción", "bloques de juguete"],
      [
        "Son juguetes.",
        "Tienen muchos colores.",
        "Los apilas.",
        "Puedes construir torres con ellos.",
      ],
    ],
  },
  {
    id: "toy_doll",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      soft: false,
      used_at_home: true,
      animal: false,
      has_wheels: false,
    },
    en: [
      "doll",
      ["doll", "a doll"],
      [
        "It is a toy.",
        "It can wear tiny clothes.",
        "It looks like a person.",
        "Children make stories while playing with it.",
      ],
    ],
    zh: [
      "玩偶",
      ["玩偶", "娃娃", "一个玩偶"],
      [
        "它是一个玩具。",
        "它可以穿小衣服。",
        "它看起来像人。",
        "孩子们会用它来编故事。",
      ],
    ],
    es: [
      "muñeca",
      ["muñeca", "una muñeca"],
      [
        "Es un juguete.",
        "Puede llevar ropa pequeña.",
        "Parece una persona.",
        "Los niños inventan historias con ella.",
      ],
    ],
  },
  {
    id: "home_chair",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      used_at_home: true,
      four_legs: true,
      soft: false,
      has_wheels: false,
    },
    en: [
      "chair",
      ["chair", "a chair"],
      [
        "You find it at home.",
        "It often has four legs.",
        "It has a back.",
        "You sit on it.",
      ],
    ],
    zh: [
      "椅子",
      ["椅子", "一把椅子"],
      [
        "你在家里能找到它。",
        "它通常有四条腿。",
        "它有靠背。",
        "你坐在它上面。",
      ],
    ],
    es: [
      "silla",
      ["silla", "una silla"],
      [
        "La encuentras en casa.",
        "Suele tener cuatro patas.",
        "Tiene respaldo.",
        "Te sientas en ella.",
      ],
    ],
  },
  {
    id: "home_spoon",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      round: false,
      soft: false,
      edible: false,
    },
    en: [
      "spoon",
      ["spoon", "a spoon"],
      [
        "You find it in a kitchen.",
        "It is small.",
        "It has a handle.",
        "You use it to eat soup.",
      ],
    ],
    zh: [
      "勺子",
      ["勺子", "汤匙", "一把勺子"],
      ["你在厨房里能找到它。", "它很小。", "它有一个柄。", "你用它喝汤。"],
    ],
    es: [
      "cuchara",
      ["cuchara", "una cuchara"],
      [
        "La encuentras en la cocina.",
        "Es pequeña.",
        "Tiene un mango.",
        "La usas para comer sopa.",
      ],
    ],
  },
  {
    id: "home_toothbrush",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      soft: false,
      edible: false,
      round: false,
    },
    en: [
      "toothbrush",
      ["toothbrush", "a toothbrush"],
      [
        "You use it at home.",
        "It has a handle.",
        "It has little bristles.",
        "It cleans your teeth.",
      ],
    ],
    zh: [
      "牙刷",
      ["牙刷", "一把牙刷"],
      ["你在家里用它。", "它有一个柄。", "它有小刷毛。", "它用来清洁牙齿。"],
    ],
    es: [
      "cepillo de dientes",
      ["cepillo de dientes", "un cepillo de dientes"],
      [
        "Lo usas en casa.",
        "Tiene un mango.",
        "Tiene cerdas pequeñas.",
        "Limpia tus dientes.",
      ],
    ],
  },
  {
    id: "home_clock",
    category: "home",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      round: true,
      soft: false,
      edible: false,
    },
    en: [
      "clock",
      ["clock", "a clock"],
      [
        "You often see it at home.",
        "It may be round.",
        "It has numbers.",
        "It tells you the time.",
      ],
    ],
    zh: [
      "时钟",
      ["时钟", "钟", "一个时钟"],
      [
        "你常在家里看到它。",
        "它可能是圆的。",
        "它上面有数字。",
        "它告诉你时间。",
      ],
    ],
    es: [
      "reloj",
      ["reloj", "un reloj"],
      [
        "Lo ves a menudo en casa.",
        "Puede ser redondo.",
        "Tiene números.",
        "Te dice la hora.",
      ],
    ],
  },
  {
    id: "home_pillow",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      used_at_home: true,
      soft: true,
      round: false,
      edible: false,
    },
    en: [
      "pillow",
      ["pillow", "a pillow"],
      [
        "You find it at home.",
        "It is soft.",
        "It goes on a bed.",
        "You rest your head on it.",
      ],
    ],
    zh: [
      "枕头",
      ["枕头", "一个枕头"],
      ["你在家里能找到它。", "它很柔软。", "它放在床上。", "你把头靠在上面。"],
    ],
    es: [
      "almohada",
      ["almohada", "una almohada"],
      [
        "La encuentras en casa.",
        "Es suave.",
        "Va sobre la cama.",
        "Apoyas la cabeza en ella.",
      ],
    ],
  },
  {
    id: "transport_bicycle",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false,
    },
    en: [
      "bicycle",
      ["bicycle", "bike", "a bicycle", "a bike"],
      [
        "It takes you places.",
        "It has two wheels.",
        "You use pedals.",
        "You wear a helmet when riding it.",
      ],
    ],
    zh: [
      "自行车",
      ["自行车", "单车", "一辆自行车"],
      [
        "它可以带你去别的地方。",
        "它有两个轮子。",
        "你要踩踏板。",
        "骑它时要戴头盔。",
      ],
    ],
    es: [
      "bicicleta",
      ["bicicleta", "bici", "una bicicleta"],
      [
        "Te lleva a lugares.",
        "Tiene dos ruedas.",
        "Usas pedales.",
        "Llevas casco para montarla.",
      ],
    ],
  },
  {
    id: "transport_bus",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false,
    },
    en: [
      "bus",
      ["bus", "a bus"],
      [
        "It is a vehicle.",
        "It is big.",
        "Many people ride together.",
        "It stops to pick up passengers.",
      ],
    ],
    zh: [
      "公共汽车",
      ["公共汽车", "公交车", "一辆公交车"],
      [
        "它是一种交通工具。",
        "它很大。",
        "很多人一起乘坐。",
        "它会停下来接乘客。",
      ],
    ],
    es: [
      "autobús",
      ["autobús", "bus", "un autobús"],
      [
        "Es un vehículo.",
        "Es grande.",
        "Muchas personas viajan juntas.",
        "Se detiene para recoger pasajeros.",
      ],
    ],
  },
  {
    id: "transport_train",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false,
    },
    en: [
      "train",
      ["train", "a train"],
      [
        "It carries people.",
        "It is very long.",
        "Its carriages join together.",
        "It travels on tracks.",
      ],
    ],
    zh: [
      "火车",
      ["火车", "一列火车"],
      ["它可以载人。", "它很长。", "车厢连接在一起。", "它在铁轨上行驶。"],
    ],
    es: [
      "tren",
      ["tren", "un tren"],
      [
        "Lleva personas.",
        "Es muy largo.",
        "Sus vagones están unidos.",
        "Viaja por vías.",
      ],
    ],
  },
  {
    id: "transport_airplane",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      flies: true,
      has_wings: true,
      swims: false,
    },
    en: [
      "airplane",
      ["airplane", "aeroplane", "plane", "an airplane"],
      [
        "It is a vehicle.",
        "It is very big.",
        "It has wings.",
        "It flies high in the sky.",
      ],
    ],
    zh: [
      "飞机",
      ["飞机", "一架飞机"],
      ["它是一种交通工具。", "它很大。", "它有翅膀。", "它在高空飞行。"],
    ],
    es: [
      "avión",
      ["avión", "un avión"],
      [
        "Es un vehículo.",
        "Es muy grande.",
        "Tiene alas.",
        "Vuela alto en el cielo.",
      ],
    ],
  },
  {
    id: "transport_boat",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      swims: true,
      has_wheels: false,
      flies: false,
      used_at_home: false,
    },
    en: [
      "boat",
      ["boat", "a boat", "ship"],
      [
        "It carries people or things.",
        "It has no road wheels.",
        "It floats.",
        "It travels on water.",
      ],
    ],
    zh: [
      "船",
      ["船", "小船", "一艘船"],
      [
        "它可以载人或物品。",
        "它没有公路轮子。",
        "它会漂浮。",
        "它在水上行驶。",
      ],
    ],
    es: [
      "barco",
      ["barco", "bote", "un barco"],
      [
        "Lleva personas o cosas.",
        "No tiene ruedas de carretera.",
        "Flota.",
        "Viaja por el agua.",
      ],
    ],
  },
  {
    id: "fairy_magic_wand",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      magical: true,
      from_a_story: true,
      used_at_home: false,
      soft: false,
    },
    en: [
      "magic wand",
      ["magic wand", "a magic wand", "wand"],
      [
        "It appears in stories.",
        "It is small enough to hold.",
        "A fairy or wizard may use it.",
        "It can cast magic spells.",
      ],
    ],
    zh: [
      "魔法棒",
      ["魔法棒", "魔杖", "一根魔法棒"],
      [
        "它会出现在故事里。",
        "它可以拿在手里。",
        "仙女或巫师会使用它。",
        "它可以施魔法。",
      ],
    ],
    es: [
      "varita mágica",
      ["varita mágica", "varita", "una varita mágica"],
      [
        "Aparece en cuentos.",
        "Cabe en una mano.",
        "La usa un hada o un mago.",
        "Puede hacer hechizos.",
      ],
    ],
  },
  {
    id: "fairy_crown",
    category: "fairy_tale",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      magical: false,
      from_a_story: true,
      used_at_home: false,
      round: true,
    },
    en: [
      "crown",
      ["crown", "a crown"],
      [
        "You see it in many stories.",
        "It can be shiny and golden.",
        "It sits on a head.",
        "A king or queen wears it.",
      ],
    ],
    zh: [
      "王冠",
      ["王冠", "皇冠", "一顶王冠"],
      [
        "很多故事里都有它。",
        "它可能金光闪闪。",
        "它戴在头上。",
        "国王或王后会戴它。",
      ],
    ],
    es: [
      "corona",
      ["corona", "una corona"],
      [
        "Aparece en muchos cuentos.",
        "Puede ser dorada y brillante.",
        "Se lleva en la cabeza.",
        "La usa un rey o una reina.",
      ],
    ],
  },
  {
    id: "fairy_glass_slipper",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      magical: true,
      from_a_story: true,
      used_at_home: false,
      soft: false,
    },
    en: [
      "glass slipper",
      ["glass slipper", "a glass slipper", "Cinderella's slipper"],
      [
        "It comes from a fairy tale.",
        "It is worn on a foot.",
        "It looks like glass.",
        "Cinderella leaves one behind.",
      ],
    ],
    zh: [
      "水晶鞋",
      ["水晶鞋", "一只水晶鞋", "灰姑娘的水晶鞋"],
      [
        "它来自童话故事。",
        "它穿在脚上。",
        "它看起来像水晶。",
        "灰姑娘落下了一只。",
      ],
    ],
    es: [
      "zapatilla de cristal",
      [
        "zapatilla de cristal",
        "zapato de cristal",
        "la zapatilla de Cenicienta",
      ],
      [
        "Viene de un cuento.",
        "Se lleva en el pie.",
        "Parece de cristal.",
        "Cenicienta deja una atrás.",
      ],
    ],
  },
  {
    id: "fairy_magic_mirror",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      big: true,
      magical: true,
      from_a_story: true,
      used_at_home: true,
      round: false,
    },
    en: [
      "magic mirror",
      ["magic mirror", "a magic mirror", "mirror"],
      [
        "A normal one can be at home.",
        "You see your reflection in it.",
        "This one can talk.",
        "The Queen asks it questions in Snow White.",
      ],
    ],
    zh: [
      "魔镜",
      ["魔镜", "一面魔镜", "镜子"],
      [
        "普通的镜子可以在家里找到。",
        "你能在里面看到自己。",
        "这面镜子会说话。",
        "《白雪公主》里的王后会问它问题。",
      ],
    ],
    es: [
      "espejo mágico",
      ["espejo mágico", "un espejo mágico", "espejo"],
      [
        "Uno normal puede estar en casa.",
        "Ves tu reflejo en él.",
        "Este puede hablar.",
        "La Reina le hace preguntas en Blancanieves.",
      ],
    ],
    stories: ["snow-white"],
  },
  {
    id: "fairy_pirate_ship",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      big: true,
      from_a_story: true,
      swims: true,
      has_wheels: false,
      flies: false,
    },
    en: [
      "pirate ship",
      ["pirate ship", "a pirate ship", "Captain Hook's ship"],
      [
        "It is very big.",
        "It travels on water.",
        "Pirates sail in it.",
        "Captain Hook has one in Peter Pan.",
      ],
    ],
    zh: [
      "海盗船",
      ["海盗船", "一艘海盗船", "虎克船长的船"],
      [
        "它很大。",
        "它在水上行驶。",
        "海盗乘坐它航行。",
        "《彼得·潘》里的虎克船长有一艘。",
      ],
    ],
    es: [
      "barco pirata",
      ["barco pirata", "un barco pirata", "el barco del Capitán Garfio"],
      [
        "Es muy grande.",
        "Viaja por el agua.",
        "Los piratas navegan en él.",
        "El Capitán Garfio tiene uno en Peter Pan.",
      ],
    ],
    stories: ["peter-pan"],
  },
];

const colorFacts: Record<string, Record<ThinkGuessLanguage, string>> = {
  animal_elephant: {
    en: "It is usually gray.",
    zh: "它通常是灰色的。",
    es: "Suele ser gris.",
  },
  animal_lion: {
    en: "It is usually golden brown.",
    zh: "它通常是金棕色的。",
    es: "Suele ser marrón dorado.",
  },
  animal_giraffe: {
    en: "It is yellow or tan with brown patches.",
    zh: "它是黄色或浅棕色的，身上有棕色斑块。",
    es: "Es amarilla o beige con manchas marrones.",
  },
  animal_penguin: {
    en: "It is black and white.",
    zh: "它是黑白相间的。",
    es: "Es blanco y negro.",
  },
  animal_butterfly: {
    en: "Its wings can have many bright colours.",
    zh: "它的翅膀可以有许多鲜艳的颜色。",
    es: "Sus alas pueden tener muchos colores vivos.",
  },
  food_apple: {
    en: "It can be red or green.",
    zh: "它可以是红色或绿色的。",
    es: "Puede ser roja o verde.",
  },
  food_banana: {
    en: "It is yellow when it is ready to eat.",
    zh: "成熟可以吃的时候，它是黄色的。",
    es: "Es amarilla cuando está lista para comer.",
  },
  food_carrot: {
    en: "It is usually orange.",
    zh: "它通常是橙色的。",
    es: "Suele ser naranja.",
  },
  food_strawberry: {
    en: "It is red with tiny yellow seeds.",
    zh: "它是红色的，上面有小小的黄色种子。",
    es: "Es roja con pequeñas semillas amarillas.",
  },
  food_pizza: {
    en: "It has several colours, often red, yellow, and golden brown.",
    zh: "它有好几种颜色，常见的是红色、黄色和金棕色。",
    es: "Tiene varios colores, a menudo rojo, amarillo y marrón dorado.",
  },
  toy_teddy_bear: {
    en: "It is often brown, but it can be other colours too.",
    zh: "它常常是棕色的，也可以是其他颜色。",
    es: "Suele ser marrón, pero también puede tener otros colores.",
  },
  toy_ball: {
    en: "It can be almost any colour.",
    zh: "它几乎可以是任何颜色。",
    es: "Puede ser de casi cualquier color.",
  },
  toy_kite: {
    en: "It can have many bright colours.",
    zh: "它可以有许多鲜艳的颜色。",
    es: "Puede tener muchos colores vivos.",
  },
  toy_blocks: {
    en: "They usually come in many bright colours.",
    zh: "它们通常有许多鲜艳的颜色。",
    es: "Suelen venir en muchos colores vivos.",
  },
  toy_doll: {
    en: "It can have many different colours.",
    zh: "它可以有许多不同的颜色。",
    es: "Puede tener muchos colores diferentes.",
  },
  home_chair: {
    en: "It can be many different colours.",
    zh: "它可以是许多不同的颜色。",
    es: "Puede ser de muchos colores diferentes.",
  },
  home_spoon: {
    en: "It is often shiny silver, though some are colourful.",
    zh: "它常常是闪亮的银色，有些也有彩色。",
    es: "Suele ser plateada y brillante, aunque algunas tienen colores.",
  },
  home_toothbrush: {
    en: "It can be many bright colours.",
    zh: "它可以是许多鲜艳的颜色。",
    es: "Puede ser de muchos colores vivos.",
  },
  home_clock: {
    en: "It can be many different colours.",
    zh: "它可以是许多不同的颜色。",
    es: "Puede ser de muchos colores diferentes.",
  },
  home_pillow: {
    en: "It can be almost any colour.",
    zh: "它几乎可以是任何颜色。",
    es: "Puede ser de casi cualquier color.",
  },
  transport_bicycle: {
    en: "It can be many different colours.",
    zh: "它可以是许多不同的颜色。",
    es: "Puede ser de muchos colores diferentes.",
  },
  transport_bus: {
    en: "It can be many colours, such as yellow, red, blue, or white.",
    zh: "它可以有许多颜色，比如黄色、红色、蓝色或白色。",
    es: "Puede ser de muchos colores, como amarillo, rojo, azul o blanco.",
  },
  transport_train: {
    en: "It can be many different colours.",
    zh: "它可以是许多不同的颜色。",
    es: "Puede ser de muchos colores diferentes.",
  },
  transport_airplane: {
    en: "It is often white with coloured markings.",
    zh: "它常常是白色的，上面有彩色标记。",
    es: "Suele ser blanco con detalles de colores.",
  },
  transport_boat: {
    en: "It can be many different colours.",
    zh: "它可以是许多不同的颜色。",
    es: "Puede ser de muchos colores diferentes.",
  },
  fairy_magic_wand: {
    en: "It is often gold, silver, or sparkly.",
    zh: "它常常是金色、银色或闪闪发光的。",
    es: "Suele ser dorada, plateada o brillante.",
  },
  fairy_crown: {
    en: "It is usually gold and may have colourful jewels.",
    zh: "它通常是金色的，也可能有彩色宝石。",
    es: "Suele ser dorada y puede tener joyas de colores.",
  },
  fairy_glass_slipper: {
    en: "It is clear and shiny like glass.",
    zh: "它像玻璃一样透明又闪亮。",
    es: "Es transparente y brillante como el cristal.",
  },
  fairy_magic_mirror: {
    en: "It is shiny silver, often with a gold frame.",
    zh: "它是闪亮的银色，常常有金色边框。",
    es: "Es plateado y brillante, a menudo con un marco dorado.",
  },
  fairy_pirate_ship: {
    en: "It is mostly brown like wood, often with dark sails.",
    zh: "它主要是木头一样的棕色，常常配有深色船帆。",
    es: "Es principalmente marrón como la madera, a menudo con velas oscuras.",
  },
};

function toAnswer(seed: Seed): AnswerObject {
  const approvedColorFacts = colorFacts[seed.id];
  if (!approvedColorFacts) {
    throw new Error(`Missing approved color facts for ${seed.id}`);
  }
  const localized = Object.fromEntries(
    (["en", "zh", "es"] as ThinkGuessLanguage[]).map((language) => {
      const [canonical, aliases, hints] = seed[language];
      return [
        language,
        {
          canonical,
          aliases,
          hints,
          facts: { color: approvedColorFacts[language] },
        },
      ];
    }),
  );

  return answerObjectSchema.parse({
    id: seed.id,
    category: seed.category,
    minimumAge: 4,
    difficulty: seed.difficulty,
    attributes: seed.attributes,
    localized,
    storyConnections: seed.stories ?? [],
  });
}

export const THINK_GUESS_ANSWERS = seeds.map(toAnswer);

export function validateAnswerLibrary(
  answers: AnswerObject[] = THINK_GUESS_ANSWERS,
): void {
  if (answers.length !== 30) {
    throw new Error(
      `The pilot library must contain 30 answers; found ${answers.length}`,
    );
  }

  const ids = new Set<string>();
  for (const answer of answers) {
    answerObjectSchema.parse(answer);
    if (ids.has(answer.id))
      throw new Error(`Duplicate answer id: ${answer.id}`);
    ids.add(answer.id);

    if (answer.attributes.big && answer.attributes.small) {
      throw new Error(`${answer.id} cannot be both big and small`);
    }
    if (
      answer.category === "animal" &&
      answer.attributes.flies &&
      answer.attributes.has_wings === false
    ) {
      throw new Error(
        `${answer.id} cannot fly while explicitly having no wings`,
      );
    }
    if (answer.category === "animal" && answer.attributes.animal !== true) {
      throw new Error(`${answer.id} must be marked as an animal`);
    }
    if (answer.category === "food" && answer.attributes.edible !== true) {
      throw new Error(`${answer.id} must be marked as edible`);
    }

    for (const language of ["en", "zh", "es"] as const) {
      const localized = answer.localized[language];
      const normalized = localized.aliases.map((alias) =>
        alias.trim().toLocaleLowerCase(),
      );
      if (!normalized.includes(localized.canonical.toLocaleLowerCase())) {
        throw new Error(
          `${answer.id}.${language} aliases must include its canonical answer`,
        );
      }
      if (new Set(normalized).size !== normalized.length) {
        throw new Error(`${answer.id}.${language} contains duplicate aliases`);
      }
    }
  }
}

validateAnswerLibrary();
