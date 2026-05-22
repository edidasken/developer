// teaching_plans.js — Static snapshot of the 'teachingPlans' Firestore collection.
// Source:   Firestore project flockos-truth, collection: teachingPlans
// Exported: 2026-04-29T07:32:58Z
// Records:  2  (one per session)
// Filter:   all statuses (Draft + Review + Approved)
//
// Each record is one session of one plan. The renderer groups by planId
// and orders by sessionNumber.
// Fields: planId, planTitle, planDescription, planAudience, planGoal,
//         sessionNumber, sessionTitle, memoryVerse, memoryVerseRef, outcome,
//         durationMinutes, segments[], scriptureRefs, tags[],
//         status ('Draft'|'Approved'|'Review'), approvedBy, approvedAt, _docId
//
// Re-generate: python "Architechtural Docs/New Covenant/Automation/Shepherds/export_teaching_plans_to_js.py"
// DO NOT EDIT — regenerate from Firestore instead.

export default [
  {
    "planTitle": "Baptism Orientation",
    "planAudience": "New believers preparing for baptism by immersion",
    "sessionTitle": "What Baptism Is, and Why I Am Being Baptized",
    "outcome": "The candidate can explain the difference between Spirit baptism and water baptism, why they are being baptized, and that baptism follows belief — it does not produce it.",
    "approvedBy": "Greg Granger",
    "tags": [
      "baptism",
      "discipleship",
      "new-believer"
    ],
    "scriptureRefs": "Matthew 28:19, John 1:33, Acts 1:5, John 14:16, Acts 1:8, John 1:25, Acts 2:38, Matthew 3:13, Acts 10:44, Luke 23:42",
    "status": "Approved",
    "segments": [
      {
        "bodyMarkdown": "> *\"When we put our faith in Jesus Christ, we surrender to Him as Lord. Jesus gave His life for us — now we no longer live for ourselves, but for our Savior. The first command Jesus gives any new believer is this: be baptized. Today we're going to learn what that means and why you're about to do it.\"*\n\n**Prayer.** Open with thanksgiving for the candidate's faith.\n\n---",
        "title": "1.1 Opening",
        "order": 1,
        "minutes": 5
      },
      {
        "bodyMarkdown": "### A. Baptism of the Holy Spirit\n\n**Read:** John 1:33 and Acts 1:5 *together*.\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | These two verses mention two kinds of baptism. What are they? | **(a) Spirit  (b) water** |\n| 2 | When does the Holy Spirit come to live in a believer? *(Eph. 1:13)* | *When we hear the Word, believe the gospel, and trust Christ.* |\n| 3 | What does it mean to be baptized by the Holy Spirit? | *When you place your faith in Christ as Lord and Savior, the Holy Spirit Himself comes to indwell you. (John 14:16–17; Acts 1:8)* |\n| 4 | What does Spirit baptism do? *(1 Cor. 12:13)* | *We are baptized by one Spirit into one body — the Church, the living body of Christ.* |\n\n### B. Baptism in Water\n\n**Read:** John 1:25–26, 33 and Acts 2:38.\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | Who first baptized people with water? | **John the Baptist** |\n| 2 | What does Acts 2:38 say is the condition for water baptism? | **Repent and believe.** |\n\n> **Leader note:** Make the distinction crystal clear — *Spirit baptism* happens at the moment of saving faith and is invisible. *Water baptism* is the visible, public sign that the invisible work has already happened.\n\n---",
        "title": "1.2 The Two Baptisms in Scripture",
        "order": 2,
        "minutes": 15
      },
      {
        "bodyMarkdown": "### A. Because Christ Commanded It — Matthew 28:19–20\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | What three steps did Jesus command? | 1. **Go**  2. **Baptize**  3. **Teach** |\n| 2 | Who should be baptized? | *Those who have made a public confession of saving faith in Christ Jesus.* |\n| 3 | What else must happen for new believers? | *Teach them to obey everything Christ commanded.* |\n| 4 | Should we obey this command? | *Yes. As followers of Christ we obey His Great Commission. (Matt. 28:19–20)* |\n\n### B. Because Jesus Set the Example — Matthew 3:13–17\n\n**Read aloud together.**\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | Was Jesus baptized willingly or unwillingly? | *Willingly — by active obedience.* |\n| 2 | Was Jesus old enough to choose for Himself? | *Yes.* |\n| 3 | Did Jesus have sins to wash away? | **No.** |\n| 4 | Was Jesus already the Son of God when He was baptized? | **Yes.** |\n| 5 | Why was Jesus baptized? *(Matt. 3:15)* | *To fulfill all righteousness. The same is true for us — baptism by immersion is the second step of testimonial obedience for the child of God. The first is to put your faith in Christ.* |\n| 6 | How was Jesus baptized? | ☐ Sprinkled  ☐ Poured  **☒ Immersed** *(Matt. 3:16 — \"He came up out of the water.\")* |\n| 7 | Was the Father pleased? | **Yes.** *(Matt. 3:17)* |\n\n---",
        "title": "1.3 Why a Believer Must Be Baptized",
        "order": 3,
        "minutes": 20
      },
      {
        "bodyMarkdown": "| # | Question | Answer |\n|---|---|---|\n| 1 | Should an infant be baptized? Why? | **No.** *An infant cannot yet place faith in Christ as Lord and Savior.* |\n| 2 | If a child was baptized before they could choose, should they be baptized again? Why? | **Yes** — *they could not yet declare their own faith and willingly identify with Christ in His death, burial, and resurrection.* |\n| 3 | Are you baptized in order to *become* a Christian, or *because* you have already become one? | *Already. Baptism is obedience that follows belief; it does not produce belief.* |\n| 4 | Put these in the right order: Water baptism · Believe in Christ · Repent · Hear the gospel · Receive the Holy Spirit | 1. Hear the gospel  2. Repent  3. Believe in Christ  4. Receive the Holy Spirit  5. Water baptism |\n| 5 | Should we follow the example of Jesus and the early Christians? *(1 Pet. 2:21)* | **Yes.** |\n\n> **Important pastoral notes:**\n> - **Acts 10:44–48** — Cornelius received the Holy Spirit *before* water baptism. Water baptism followed salvation; it did not cause it.\n> - **Luke 23:42–43** — The thief on the cross was never baptized, yet went to paradise because of his faith. Baptism is *commanded*, but it is not *what saves*.\n\n---",
        "title": "1.4 Review — What We Just Learned",
        "order": 4,
        "minutes": 10
      },
      {
        "bodyMarkdown": "Ask the candidate, in their own words:\n\n> **\"What is baptism, and why are you choosing to be baptized?\"**\n\nIf they can answer this clearly, they are ready for Session 2. If not, walk back through Section 1.2 before next time.\n\n**Close in prayer.** Thank God for their faith and ask Him to prepare their heart for Session 2 — the meaning and symbolism of baptism itself.\n\n---",
        "title": "1.5 Reflection & Send-Off",
        "order": 5,
        "minutes": 5
      }
    ],
    "planId": "baptism-orientation",
    "planDescription": "Two sessions (~60–75 minutes each), open Bible together",
    "memoryVerse": "Therefore go and make disciples of all nations, baptizing them...",
    "planGoal": "That every candidate be able to (1) explain why they are being baptized, (2) give scriptural reasons for baptism by immersion, and (3) understand what their baptism publicly declares.",
    "memoryVerseRef": "Matthew 28:19",
    "sortOrder": 0,
    "durationMinutes": 60,
    "approvedAt": "2026-04-29T07:32:56.152944+00:00",
    "sessionNumber": 1,
    "_docId": "baptism-orientation_session-1"
  },
  {
    "planTitle": "Baptism Orientation",
    "planAudience": "New believers preparing for baptism by immersion",
    "sessionTitle": "The Picture Baptism Paints, and the Right Time to Be Baptized",
    "outcome": "The candidate can explain what baptism by immersion symbolizes, why immersion (not sprinkling) is the biblical mode, and that the right time to be baptized is after belief — never before.",
    "approvedBy": "Greg Granger",
    "tags": [
      "baptism",
      "discipleship",
      "new-believer"
    ],
    "scriptureRefs": "Romans 6:4, Acts 16:13, Acts 16:25, Acts 2:36, Acts 8:35, Romans 6:3, Ephesians 4:22, 1 Corinthians 6:19, Galatians 3:27, 1 Corinthians 12:12, Romans 6:16, Acts 10:44, Luke 23:42",
    "status": "Approved",
    "segments": [
      {
        "bodyMarkdown": "> *\"Last time we learned **what** baptism is and **why** Jesus commands it. Today we'll learn **how** the early church practiced it, **what** it pictures, and **when** the right time to be baptized actually is.\"*\n\n**Prayer.** Ask God to make today's lesson land in obedience, not just understanding.\n\n---",
        "title": "2.1 Opening",
        "order": 1,
        "minutes": 5
      },
      {
        "bodyMarkdown": "### A. Lydia — Acts 16:13–15\n\n**Read aloud.**\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | Who was baptized? | *Lydia — already a worshiper of God, but not yet baptized.* |\n| 2 | Verse 14a — Lydia ___ Paul's teaching. | **heard** |\n| 3 | Verse 14b — God ___ her ___. | **opened / heart** |\n| 4 | Verse 14c — She ___ to Paul's message. | **responded** |\n| 5 | Verse 15 — Then she was ___. | **baptized** |\n\n### B. The Philippian Jailer — Acts 16:25–34\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | How did the jailer become a Christian? *(vv. 29, 32)* | *He heard the gospel and then believed in Christ.* |\n| 2 | What was the next step after he trusted Christ? *(vv. 33–34)* | *He was baptized.* |\n| 3 | What happened to his whole household after they believed? | *They were baptized.* |\n\n### C. The Pattern in Both Stories\n\nNumber these in order:\n\n| Order | Step |\n|---|---|\n| **1st** | They heard the gospel. |\n| **2nd** | They believed. |\n| **3rd** | They were baptized. |\n\n> **Leader note:** Belief always precedes baptism in the New Testament. Always.\n\n---",
        "title": "2.2 The Pattern of the Very First Christians",
        "order": 2,
        "minutes": 15
      },
      {
        "bodyMarkdown": "### A. Acts 2:36–41\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | What two conditions for baptism does Peter give? | 1. **Repent** *(v. 38, also Rom. 10:9)*  2. **Believe in Christ** *(v. 41)* |\n| 2 | What happened after they were baptized? *(vv. 41b–42)* | *They were added to the early church and devoted themselves to its life.* |\n\n### B. The Ethiopian Eunuch — Acts 8:35–38\n\n| # | Question | Answer |\n|---|---|---|\n| 1 | What is necessary before baptism? *(vv. 36–37)* | *Whole-hearted belief in Jesus Christ — placing trust and faith in Him.* |\n| 2 | Do infants have this? | **No.** |\n| 3 | What kind of baptism happened? *(vv. 38–39)* | ☐ Sprinkled  ☐ Poured  **☒ Immersion** |\n| 4 | Why do you say so? | *Because the eunuch came up out of the water (v. 39).* |\n\n> **Greek word study:**\n> The word baptism translates the Greek **βαπτίζω (baptizō)** — meaning \"to dip\" or \"to immerse.\"\n> There is no biblical or linguistic evidence the word ever meant \"sprinkle\" or \"pour.\"\n> Just as in English the word \"dip\" never means \"sprinkle,\" the biblical word means plainly: **to be immersed under water.**\n\n---",
        "title": "2.3 Pentecost & The Eunuch",
        "order": 3,
        "minutes": 10
      },
      {
        "bodyMarkdown": "**Read together:** Romans 6:3–13.\n\n### A. Three Events in Jesus' Life Pictured in Baptism *(vv. 3–4)*\n\n1. **Death**\n2. **Burial**\n3. **Resurrection**\n\n### B. Which Mode Pictures All Three?\n\n☐ Sprinkling   **☒ Immersion**   ☐ Pouring\n\n### C. What Does Each Movement Symbolize?\n\n| Action | What it pictures |\n|---|---|\n| **Going under the water** *(vv. 4, 11)* | Dying to sin and to the old self-centered life |\n| **Coming up from under the water** *(v. 5)* | Public testimony that we are united with Christ in His resurrection |\n| **Leaving the water** *(v. 4)* | Walking in newness of life, indwelt by the Holy Spirit |\n\n### D. How Do We Walk in This New Life?\n\n> *Our old nature of self-centered living is replaced by the new nature of Jesus Christ.* (Ephesians 4:22–24)\n\n> **Key truth:** Baptism in water is a public testimony — we surrender our self-will to God's will. We now belong to Christ. *(1 Corinthians 6:19–20)*\n\n### E. Galatians 3:27 — A Picture of Putting On Christ\n\n> What words does Paul use to describe what happens at conversion and baptism?\n\n*We \"put on the Lord Jesus.\" The nature of Christ is what people should see in our new nature.* (Eph. 4:24)\n\n### F. 1 Corinthians 12:12–13 — Joined to the Body\n\n> Through physical birth we became descendants of Adam. How do we become members of Christ's body?\n\n*By the baptism of the Spirit (which makes us part of His body), and water baptism by immersion (which publicly declares it). It is the symbol of our union with Christ.*\n\n---",
        "title": "2.4 The Symbol and Meaning of Baptism",
        "order": 4,
        "minutes": 20
      },
      {
        "bodyMarkdown": "### A. Which of these must be true of a person being baptized?\n\n- ☒ Ability to choose\n- ☒ Ability to repent\n- ☒ Ability to believe\n- ☒ Ability to understand and declare what baptism means\n\n### B. Are these true of an infant?\n\n**No.**\n\n> **Closing leader note:**\n> A true believer must declare their faith publicly. Jesus commanded that this be done through water baptism by immersion. When we are baptized, we are saying:\n> *\"I am burying my old sinful ways and rising to live a new life with Christ as my Lord.\"*\n> This is to be done in **God's way** (immersion) and at **God's time** (after saving faith). *(Romans 6:16–18)*\n\n---",
        "title": "2.5 The Right Time for Baptism",
        "order": 5,
        "minutes": 10
      },
      {
        "bodyMarkdown": "Ask the candidate:\n\n> **\"Are you ready to publicly declare with your body what Christ has already done in your heart?\"**\n\nIf yes — schedule the baptism.\nIf they are unsure — that's okay. Walk through the gospel one more time and let the Spirit work. Baptism delayed is far better than baptism without belief.\n\n**Close in prayer.**\n\n---\n\n# Leader's Quick-Reference Card\n\n## The Five Steps in Order\n1. Hear the gospel\n2. Repent\n3. Believe in Christ\n4. Receive the Holy Spirit\n5. Water baptism\n\n## Two Baptisms\n| | Spirit Baptism | Water Baptism |\n|---|---|---|\n| **When** | Moment of saving faith | After saving faith |\n| **By whom** | The Holy Spirit | A pastor / believer |\n| **Visible?** | No | Yes |\n| **What it does** | Joins us to the Body of Christ | Publicly declares we belong to Christ |\n\n## Three Things Pictured by Immersion\n- Death — going under\n- Burial — being submerged\n- Resurrection — rising up\n\n## Two Important \"Yes, but…\" Cases\n- **Cornelius** (Acts 10:44–48) — received the Spirit *before* water baptism, proving baptism doesn't save.\n- **Thief on the cross** (Luke 23:42–43) — never baptized, yet went to paradise, proving faith alone saves.\n\n## Common Questions to Be Ready For\n- *\"What about infant baptism?\"* → It cannot be valid because faith and repentance must come first. A person baptized as an infant should be baptized again upon belief.\n- *\"Will I lose my salvation if I'm not baptized?\"* → No — baptism doesn't save. But disobeying Christ's clear command is a serious matter for a believer.\n- *\"What if I'm afraid?\"* → Fear in obedience is normal. Christ Himself was baptized; He stands with you.\n\n---\n\n*Source: Baptism Orientation Part I and Part II, Trinity Baptist Church.*",
        "title": "2.6 Reflection & Commitment",
        "order": 6,
        "minutes": 5
      }
    ],
    "planId": "baptism-orientation",
    "planDescription": "Two sessions (~60–75 minutes each), open Bible together",
    "memoryVerse": "We were therefore buried with Him through baptism into death, in order that, just as Christ was raised from the dead through the glory of the Father, we too may live a new life.",
    "planGoal": "That every candidate be able to (1) explain why they are being baptized, (2) give scriptural reasons for baptism by immersion, and (3) understand what their baptism publicly declares.",
    "memoryVerseRef": "Romans 6:4",
    "sortOrder": 1,
    "durationMinutes": 60,
    "approvedAt": "2026-04-29T07:32:56.153615+00:00",
    "sessionNumber": 2,
    "_docId": "baptism-orientation_session-2"
  }
];
