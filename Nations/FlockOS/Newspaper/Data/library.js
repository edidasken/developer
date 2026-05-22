// library.js — Static bundle: 66 books of the Bible (Genesis → Revelation)
// Source:   Hand-curated canonical list (Protestant canon)
// Each entry: { Book, Testament, Genre, Summary }

export default [
  // ── Old Testament · Law (Pentateuch) ─────────────────────────────────
  { Book: 'Genesis',        Testament: 'Old', Genre: 'Law',     Summary: 'Creation, fall, flood, and the patriarchs — God begins His covenant with Abraham, planting the seed of redemption.' },
  { Book: 'Exodus',         Testament: 'Old', Genre: 'Law',     Summary: 'God rescues Israel from Egypt, gives the Law at Sinai, and dwells with His people in the Tabernacle.' },
  { Book: 'Leviticus',      Testament: 'Old', Genre: 'Law',     Summary: 'A holy God provides sacrifice and priesthood so a sinful people can dwell with Him.' },
  { Book: 'Numbers',        Testament: 'Old', Genre: 'Law',     Summary: 'Israel\u2019s wilderness wandering — faithlessness met with God\u2019s steadfast covenant love.' },
  { Book: 'Deuteronomy',    Testament: 'Old', Genre: 'Law',     Summary: 'Moses\u2019 final sermons — covenant renewed on the edge of the Promised Land.' },

  // ── Old Testament · Historical ───────────────────────────────────────
  { Book: 'Joshua',         Testament: 'Old', Genre: 'Historical', Summary: 'Israel enters the land — God fights for His people and gives them the inheritance He promised.' },
  { Book: 'Judges',         Testament: 'Old', Genre: 'Historical', Summary: 'A cycle of sin, oppression, and rescue — \u201Ceveryone did what was right in his own eyes.\u201D' },
  { Book: 'Ruth',           Testament: 'Old', Genre: 'Historical', Summary: 'A Moabite widow finds redemption in Boaz — and becomes great-grandmother to King David.' },
  { Book: '1 Samuel',       Testament: 'Old', Genre: 'Historical', Summary: 'From Samuel and Saul to David — God raises up the king after His own heart.' },
  { Book: '2 Samuel',       Testament: 'Old', Genre: 'Historical', Summary: 'David\u2019s reign — covenant promises of an eternal throne, alongside human failure.' },
  { Book: '1 Kings',        Testament: 'Old', Genre: 'Historical', Summary: 'Solomon\u2019s glory, the divided kingdom, and the prophets who call God\u2019s people back.' },
  { Book: '2 Kings',        Testament: 'Old', Genre: 'Historical', Summary: 'Decline and exile — yet a remnant of hope as both kingdoms fall.' },
  { Book: '1 Chronicles',   Testament: 'Old', Genre: 'Historical', Summary: 'Israel\u2019s genealogies and David\u2019s reign retold — preparing the temple and its worship.' },
  { Book: '2 Chronicles',   Testament: 'Old', Genre: 'Historical', Summary: 'Judah\u2019s kings and the temple — a priestly history pointing toward restoration.' },
  { Book: 'Ezra',           Testament: 'Old', Genre: 'Historical', Summary: 'Return from exile, rebuilding the temple, and renewing covenant fidelity.' },
  { Book: 'Nehemiah',       Testament: 'Old', Genre: 'Historical', Summary: 'Jerusalem\u2019s walls rebuilt — and the people\u2019s hearts re-anchored to God\u2019s Word.' },
  { Book: 'Esther',         Testament: 'Old', Genre: 'Historical', Summary: 'God\u2019s hidden providence preserves His people \u201Cfor such a time as this.\u201D' },

  // ── Old Testament · Wisdom & Poetry ──────────────────────────────────
  { Book: 'Job',            Testament: 'Old', Genre: 'Wisdom',  Summary: 'A righteous sufferer wrestles with God and finds He is greater than every answer.' },
  { Book: 'Psalms',         Testament: 'Old', Genre: 'Wisdom',  Summary: 'The prayer-book of God\u2019s people — every emotion brought before the King.' },
  { Book: 'Proverbs',       Testament: 'Old', Genre: 'Wisdom',  Summary: 'The fear of the LORD is the beginning of wisdom — practical living under God.' },
  { Book: 'Ecclesiastes',   Testament: 'Old', Genre: 'Wisdom',  Summary: 'Life \u201Cunder the sun\u201D is vanity apart from God; in Him all things have meaning.' },
  { Book: 'Song of Solomon', Testament: 'Old', Genre: 'Wisdom', Summary: 'A poetic celebration of covenant love — and a picture of Christ\u2019s love for His Bride.' },

  // ── Old Testament · Major Prophets ───────────────────────────────────
  { Book: 'Isaiah',         Testament: 'Old', Genre: 'Prophet', Summary: 'A vision of judgment and salvation — the Suffering Servant who saves His people.' },
  { Book: 'Jeremiah',       Testament: 'Old', Genre: 'Prophet', Summary: 'The weeping prophet warns of exile — and promises a New Covenant written on the heart.' },
  { Book: 'Lamentations',   Testament: 'Old', Genre: 'Prophet', Summary: 'Tears over fallen Jerusalem — yet \u201Chis mercies are new every morning.\u201D' },
  { Book: 'Ezekiel',        Testament: 'Old', Genre: 'Prophet', Summary: 'God\u2019s glory departs and returns — dry bones live again by His Spirit.' },
  { Book: 'Daniel',         Testament: 'Old', Genre: 'Prophet', Summary: 'Faithfulness in exile and visions of God\u2019s sovereign rule over the kingdoms of men.' },

  // ── Old Testament · Minor Prophets ───────────────────────────────────
  { Book: 'Hosea',          Testament: 'Old', Genre: 'Prophet', Summary: 'God\u2019s relentless covenant love for an unfaithful people.' },
  { Book: 'Joel',           Testament: 'Old', Genre: 'Prophet', Summary: 'The Day of the LORD — judgment, repentance, and the outpouring of the Spirit.' },
  { Book: 'Amos',           Testament: 'Old', Genre: 'Prophet', Summary: 'Justice rolling down like waters — God\u2019s heart for the oppressed.' },
  { Book: 'Obadiah',        Testament: 'Old', Genre: 'Prophet', Summary: 'Edom\u2019s pride judged — the kingdom belongs to the LORD.' },
  { Book: 'Jonah',          Testament: 'Old', Genre: 'Prophet', Summary: 'A reluctant prophet, a great fish, and a city saved — God\u2019s mercy reaches the nations.' },
  { Book: 'Micah',          Testament: 'Old', Genre: 'Prophet', Summary: '\u201CDo justice, love mercy, walk humbly\u201D — and a Ruler from Bethlehem.' },
  { Book: 'Nahum',          Testament: 'Old', Genre: 'Prophet', Summary: 'Nineveh judged — God is slow to anger but mighty in power.' },
  { Book: 'Habakkuk',       Testament: 'Old', Genre: 'Prophet', Summary: '\u201CThe just shall live by faith\u201D — wrestling honestly with God\u2019s justice.' },
  { Book: 'Zephaniah',      Testament: 'Old', Genre: 'Prophet', Summary: 'The Day of the LORD brings judgment — and a singing Savior over His people.' },
  { Book: 'Haggai',         Testament: 'Old', Genre: 'Prophet', Summary: '\u201CConsider your ways\u201D — rebuild God\u2019s house and put Him first.' },
  { Book: 'Zechariah',      Testament: 'Old', Genre: 'Prophet', Summary: 'Visions of the coming King who rides on a donkey — and is pierced for His people.' },
  { Book: 'Malachi',        Testament: 'Old', Genre: 'Prophet', Summary: 'A final word before silence — the Messenger of the covenant is coming.' },

  // ── New Testament · Gospels ──────────────────────────────────────────
  { Book: 'Matthew',        Testament: 'New', Genre: 'Gospel',  Summary: 'Jesus, the long-promised King — Israel\u2019s story finds its fulfillment.' },
  { Book: 'Mark',           Testament: 'New', Genre: 'Gospel',  Summary: 'Jesus the Servant — moving with urgency to the cross.' },
  { Book: 'Luke',           Testament: 'New', Genre: 'Gospel',  Summary: 'Jesus the Savior of the lost — for the poor, the outsider, and the world.' },
  { Book: 'John',           Testament: 'New', Genre: 'Gospel',  Summary: 'The Word made flesh — full of grace and truth, that you may believe and have life.' },

  // ── New Testament · History ──────────────────────────────────────────
  { Book: 'Acts',           Testament: 'New', Genre: 'Historical', Summary: 'The Spirit-empowered church — the gospel from Jerusalem to the ends of the earth.' },

  // ── New Testament · Pauline Letters ──────────────────────────────────
  { Book: 'Romans',         Testament: 'New', Genre: 'Letter',  Summary: 'The gospel of God in Jesus Christ — explained from sin to glory.' },
  { Book: '1 Corinthians',  Testament: 'New', Genre: 'Letter',  Summary: 'A divided church called back to the cross, love, and the resurrection.' },
  { Book: '2 Corinthians',  Testament: 'New', Genre: 'Letter',  Summary: 'Treasure in jars of clay — strength made perfect in weakness.' },
  { Book: 'Galatians',      Testament: 'New', Genre: 'Letter',  Summary: 'Justified by faith alone — \u201Cif righteousness comes through the Law, then Christ died in vain.\u201D' },
  { Book: 'Ephesians',      Testament: 'New', Genre: 'Letter',  Summary: 'Chosen, redeemed, and seated with Christ — the riches of grace and the unity of the church.' },
  { Book: 'Philippians',    Testament: 'New', Genre: 'Letter',  Summary: 'Joy in Christ — \u201Cto live is Christ, and to die is gain.\u201D' },
  { Book: 'Colossians',     Testament: 'New', Genre: 'Letter',  Summary: 'Christ supreme — in Him all the fullness of deity dwells bodily.' },
  { Book: '1 Thessalonians', Testament: 'New', Genre: 'Letter', Summary: 'Faith, love, and hope — living in light of Christ\u2019s return.' },
  { Book: '2 Thessalonians', Testament: 'New', Genre: 'Letter', Summary: 'Stand firm — the Day of the Lord and the call to faithful work.' },
  { Book: '1 Timothy',      Testament: 'New', Genre: 'Letter',  Summary: 'Order in God\u2019s household — sound doctrine and godly leadership.' },
  { Book: '2 Timothy',      Testament: 'New', Genre: 'Letter',  Summary: 'Paul\u2019s final charge — \u201CI have fought the good fight, I have kept the faith.\u201D' },
  { Book: 'Titus',          Testament: 'New', Genre: 'Letter',  Summary: 'Sound doctrine and godly living in the church.' },
  { Book: 'Philemon',       Testament: 'New', Genre: 'Letter',  Summary: 'Reconciliation in Christ — a runaway slave received as a beloved brother.' },

  // ── New Testament · General Letters ──────────────────────────────────
  { Book: 'Hebrews',        Testament: 'New', Genre: 'Letter',  Summary: 'Christ is greater — better priest, better sacrifice, better covenant.' },
  { Book: 'James',          Testament: 'New', Genre: 'Letter',  Summary: 'Faith that works — wisdom for the everyday Christian life.' },
  { Book: '1 Peter',        Testament: 'New', Genre: 'Letter',  Summary: 'Hope and holiness in suffering — strangers and pilgrims of God.' },
  { Book: '2 Peter',        Testament: 'New', Genre: 'Letter',  Summary: 'Stand firm against false teachers — grow in the grace and knowledge of Christ.' },
  { Book: '1 John',         Testament: 'New', Genre: 'Letter',  Summary: 'Tests of true faith — light, love, and life in Christ.' },
  { Book: '2 John',         Testament: 'New', Genre: 'Letter',  Summary: 'Walk in truth and love — guard the apostolic gospel.' },
  { Book: '3 John',         Testament: 'New', Genre: 'Letter',  Summary: 'Hospitality, faithfulness, and walking in the truth.' },
  { Book: 'Jude',           Testament: 'New', Genre: 'Letter',  Summary: 'Contend for the faith once for all delivered to the saints.' },

  // ── New Testament · Apocalypse ───────────────────────────────────────
  { Book: 'Revelation',     Testament: 'New', Genre: 'Apocalypse', Summary: 'The Lamb who was slain reigns forever — the unveiling of Jesus Christ and the new creation.' },
];
