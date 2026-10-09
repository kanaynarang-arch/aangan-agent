/**
 * Offline test cases. Each is a short paraphrased summary of one enquiry call
 * (written for this repo; not the original transcript). Names and phone numbers
 * are invented. Agent lines never contain a price.
 */
export interface Case {
  id: string;
  /** Call start, India time, ISO local. Used as "today" for timeline maths. */
  startedAtLocal: string;
  durationSeconds: number;
  phone: string | null;
  transcript: string | null;
  expected: {
    tier: "green" | "amber" | "red" | "escalate" | "dropped";
    askedPrice?: boolean;
    handleWithCare?: boolean;
    /** Case-insensitive pattern the uncertain list should match. */
    uncertain?: RegExp;
  };
  note?: string;
}

export const CASES: Case[] = [
  {
    id: "T01", startedAtLocal: "2026-09-02T10:23", durationSeconds: 250, phone: "9000000001",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Asha. A friend who had her flat done by you suggested I call.
Agent: Lovely. What would you like to do?
Caller: It's our own 3BHK in Kothrud, roughly 1,400 sq ft carpet area, and it's still just as the builder left it. The kitchen, the living room and both bedrooms need a full redo.
Agent: And when would you like it ready?
Caller: By March next year, no rush.
Agent: Are you the owner, and will you be deciding?
Caller: Yes, me and my husband. He knows I am calling and is happy to go ahead.
Agent: Which day and time suits you for a consultation?
Caller: Early next week, afternoon is fine. My number is 9000000001.`,
    expected: { tier: "green" },
  },
  {
    id: "T02", startedAtLocal: "2026-09-03T14:41", durationSeconds: 300, phone: "9000000002",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Ravi. I saw your work on Instagram.
Agent: Thanks Ravi. What are you planning?
Caller: A full redesign of our 2BHK in Wakad, about 950 sq ft: modular kitchen, wardrobes, living room, both bedrooms. Can you tell me roughly what that costs?
Agent: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.
Caller: Can you at least give me a ballpark range?
Agent: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.
Agent: When would you like to start?
Caller: We move into the flat in November, so design could start in October.
Agent: Are you the one deciding on the project?
Caller: Yes, my wife and I together, we both agree.
Caller: Okay, fair enough. Let's book the consultation. Thursday evening works. My number is 9000000002.`,
    expected: { tier: "green", askedPrice: true },
  },
  {
    id: "T03", startedAtLocal: "2026-09-03T16:15", durationSeconds: 160, phone: "9000000003",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Sandeep. I'm in Nashik. Can you take on a home office and study redesign here?
Agent: Thanks, Sandeep. Right now our work is limited to Pune and PCMC, since that is where our own contractors and vendors operate, so a project in Nashik is outside what we can take on. I'm sorry.
Caller: Not even for a small one?
Agent: Even a small project depends on our own contractors being on site, so no. This sounds like it may not be the right fit for us right now, but feel free to reach out if your location changes.
Caller: Understood, thanks.`,
    expected: { tier: "red" },
  },
  {
    id: "T04", startedAtLocal: "2026-09-04T11:07", durationSeconds: 200, phone: "9000000004",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Meera. Could someone come over and give us ideas for our living room? Colours, furniture arrangement, that kind of thing.
Agent: Thanks Meera. We are a full-service studio, so our projects are design together with execution. We don't do advice-only visits. Are you planning a full redesign with execution?
Caller: No, we're just exploring for now. Maybe later.
Agent: Of course. This sounds like it may not be the right fit for us right now, but feel free to reach out if your plans change.`,
    expected: { tier: "red" },
  },
  {
    id: "T05", startedAtLocal: "2026-09-05T10:52", durationSeconds: 400, phone: "9000000005",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Kavita. A friend of the founder suggested I call.
Agent: Welcome Kavita. What are you looking to do?
Caller: We want the whole 4BHK in Koregaon Park redone, around 2,400 sq ft carpet area, with new floors, a new kitchen and all four bedrooms. The family has shifted out for now.
Agent: When do you want to move back in?
Caller: By February, so about four months.
Agent: Are you the decision-maker?
Caller: Yes, my husband and I decide together and he is fully on board.
Agent: Would you like a site visit for the consultation?
Caller: Yes please, early next week. My number is 9000000005.`,
    expected: { tier: "green" },
  },
  {
    id: "T06", startedAtLocal: "2026-09-05T15:28", durationSeconds: 300, phone: "9000000006",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Dev, calling about a commercial space for our startup.
Agent: Thanks Dev. Where is it and how big?
Caller: In Baner, roughly 800 sq ft, currently an empty shell. The brief is desks for 20 people, one small cabin, a meeting room and a pantry corner.
Agent: When do you need to be operational?
Caller: We'd like to be in by December. The team is remote at the moment.
Agent: Are you the decision-maker?
Caller: Yes, I'm the founder.
Agent: Which day suits you for a consultation?
Caller: Tuesday morning. My number is 9000000006.`,
    expected: { tier: "green" },
  },
  {
    id: "T07", startedAtLocal: "2026-09-08T09:44", durationSeconds: 195, phone: "9000000007",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Nisha. I want my living room and kitchen redone before Diwali. Can you do it?
Agent: Thanks Nisha. Diwali is roughly three weeks out, and the design stage alone runs three to four weeks before execution can start, so we can't do the project justice in that window.
Caller: Even just the living room?
Agent: Even for one room, design and execution take far longer than that, and we don't like to rush. Starting once Diwali is over, around November, would suit us much better.
Caller: What if I start after Diwali?
Agent: A November start would work. Shall I note your details for that?
Caller: Let me think and call back. The flat is in Aundh, by the way, and I own it.`,
    expected: { tier: "amber" },
  },
  {
    id: "T08", startedAtLocal: "2026-09-09T22:47", durationSeconds: 0, phone: "9000000008",
    transcript: null,
    expected: { tier: "dropped" },
    note: "Missed call at night, no voicemail, no transcript. Number is in the Nanded City area.",
  },
  {
    id: "T09", startedAtLocal: "2026-09-10T11:32", durationSeconds: 350, phone: "9000000009",
    transcript: `Caller: I need to speak to someone right now. My project has been going for three months and my designer has not replied in five days.
Agent: I'm very sorry to hear that. Can I take your name and your designer's name?
Caller: Sheela. My designer is Arun. It's a 2BHK in Viman Nagar. I've sent three messages and called twice.
Agent: Thank you Sheela. A senior person will call you back within 15 minutes. What is the best number?
Caller: It's 9000000009. I'd like the founder or someone senior to ring me, not simply whoever is free.
Agent: Noted. I'll pass that on right now.`,
    expected: { tier: "escalate" },
  },
  {
    id: "T10", startedAtLocal: "2026-09-11T14:04", durationSeconds: 220, phone: "9000000010",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Tarun here. It's a 550 sq ft 1BHK in Kharadi and I'd like the kitchen and one bedroom done. I can spend one to one and a half lakh at most for the whole thing. Can that work?
Agent: Thanks for being open about that. A kitchen plus a bedroom, fully executed with materials, furniture and labour, would come to well beyond that figure, and I'd rather not have you travel to a consultation that can't work out.
Caller: Even for one bedroom?
Agent: Even for one room, I'm afraid. This sounds like it may not be the right fit for us right now, but feel free to reach out if your scope or budget changes.
Caller: Okay, thanks for being straight.`,
    expected: { tier: "red" },
  },
  {
    id: "T11", startedAtLocal: "2026-09-12T10:18", durationSeconds: 380, phone: "9000000011",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Isha here. I live in a rented flat. Is that something you can still work on?
Agent: It depends on the scope. What would you like to do?
Caller: A 2BHK in Baner, leased for three years, and it's fairly empty. I'd like the living room, the bedroom and the kitchen designed well. Nothing structural, only design and fittings.
Agent: That's fine, we have done rented flats. Does your landlord agree?
Caller: Yes, as long as we don't break walls.
Agent: Are you deciding on this yourself?
Caller: Yes, it's my decision. Please set up a consultation, any weekday evening. My number is 9000000011.`,
    expected: { tier: "green" },
  },
  {
    id: "T12", startedAtLocal: "2026-09-15T10:05", durationSeconds: 450, phone: "9000000012",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Anil. It's a villa in Kalyani Nagar, around 5,500 sq ft across ground and two upper floors, and I want complete design from start to finish.
Agent: Is it a new property or an existing home?
Caller: New construction, possession last month, completely empty.
Agent: When do you want to move in?
Caller: March next year, no rush.
Agent: Are you the owner and decision-maker?
Caller: Yes, it's mine.
Agent: Would you like our principal designer to visit the site?
Caller: Yes, this week or next. My number is 9000000012.`,
    expected: { tier: "green" },
  },
  {
    id: "T13", startedAtLocal: "2026-09-16T12:19", durationSeconds: 370, phone: "9000000013",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Vijay. My 3BHK in Aundh, about 1,100 sq ft, needs redoing. Roughly what would that cost?
Agent: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.
Caller: Can't you give me even a rough range, just to know if we're in the same ballpark?
Agent: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.
Agent: What are you planning to do?
Caller: Kitchen, wardrobes in both bedrooms and the living room. Fine, let's book then.
Agent: Are you the owner?
Caller: Yes, I own it and I'm the one deciding. Saturday morning works. My number is 9000000013.`,
    expected: { tier: "green", askedPrice: true },
  },
  {
    id: "T14", startedAtLocal: "2026-09-17T11:41", durationSeconds: 295, phone: "9000000014",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Rakesh. I'm enquiring about an interior project for my parents' newly possessed 3BHK in Hadapsar. They want a proper design.
Agent: Are your parents going to take part in deciding?
Caller: Yes. I'm doing the initial checking because they don't use phones much. They will decide.
Agent: Would your parents attend the consultation?
Caller: Yes, they would come. I'm just calling to see if it's worth pursuing.
Agent: I'll take down your details and walk you through what a consultation covers. What's your number?
Caller: 9000000014. Weekend would be best for them.`,
    expected: { tier: "green", uncertain: /parent|son|decision/i },
  },
  {
    id: "T15", startedAtLocal: "2026-09-18T15:12", durationSeconds: 345, phone: "9000000015",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Smriti. My 2BHK in Undri, 875 sq ft, is handed over in around six weeks and I'd like the design to begin straight away.
Agent: Six weeks gives us barely enough time to settle the design before execution starts. What do you have in mind?
Caller: The full home package: kitchen, wardrobes, living room.
Agent: Are you the owner?
Caller: Yes, both of us, my husband and me. He's asked me to go ahead and book it.
Agent: Can we see the site now, or do you have to wait for possession?
Caller: We can visit already because the builder allows access. Next Monday suits us. My number is 9000000015.`,
    expected: { tier: "green" },
  },
  {
    id: "T16", startedAtLocal: "2026-09-19T10:38", durationSeconds: 320, phone: "9000000016",
    transcript: `Caller: I called on Monday about a project and someone said they'd get back to me. It's been two days and nothing.
Agent: I'm very sorry about that. May I have your name?
Caller: Gopal. Earlier in the week I phoned about a 3BHK of mine in Viman Nagar and left a contact number.
Agent: I apologise, I don't see a note of it. Could you give me your details again? I'll make sure it doesn't slip this time.
Caller: That doesn't bode well, forgetting me before we've begun. It's the 3BHK in Viman Nagar, a complete redesign, and the flat is mine. My number is 9000000016, and any weekday morning works for the consultation.
Agent: You're right, and I'm sorry. I'm passing this to the team now with a note that you were let down earlier.`,
    expected: { tier: "green", handleWithCare: true },
  },
  {
    id: "T17", startedAtLocal: "2026-09-22T14:16", durationSeconds: 270, phone: "9000000017",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Rita. I called a minute ago and got cut off. I'm in Pimple Saudagar, a 3BHK of about 1,050 sq ft. We've lived here two years but never did the interiors properly.
Agent: Pimple Saudagar falls within the area we serve. What work are you after?
Caller: Kitchen, wardrobes and living room. The builder furniture is very basic.
Agent: When would you like it ready?
Caller: Ideally by March, plenty of time.
Agent: Are you the owner and decision-maker?
Caller: Yes, my husband and I both, and we agree.
Agent: Let me note a consultation. Which day suits you?
Caller: Wednesday after 4pm. My number is 9000000017.`,
    expected: { tier: "green" },
    note: "Second call of a pair; the first call dropped (see T17a).",
  },
  {
    id: "T18", startedAtLocal: "2026-09-23T11:55", durationSeconds: 180, phone: "9000000018",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Farhan. I manage a coworking centre and there's a 180 sq ft pod I'd like to fit out well, with good lighting, a decent desk and some storage. Is that something you do?
Agent: Our commercial work usually starts at 500 sq ft, so a 180 sq ft pod falls under our minimum.
Caller: Not even for a smaller fee?
Agent: It's not the fee. Our team is built for projects of a certain size, and I'd rather not promise quality we can't deliver. A local designer who focuses on small spaces would serve you better. This may simply not be the right match for us at the moment.
Caller: Fair enough, thanks.`,
    expected: { tier: "red" },
  },
  {
    id: "T19", startedAtLocal: "2026-09-24T16:02", durationSeconds: 170, phone: "9000000019",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Zoya. I'm opening a restaurant in Koregaon Park and I admire your work. Would you design its interiors?
Agent: Thanks, Zoya. Interiors for restaurants and hospitality are not something we take on. Our focus is homes and offices, and hospitality involves quite different materials and regulations. A studio specialising in that area would suit you better.
Caller: Do you know anyone to refer?
Agent: I can't confidently point you to a particular studio, but looking up hospitality interior designers in Pune should give you good choices.
Caller: Alright, thanks.`,
    expected: { tier: "red" },
  },
  {
    id: "T20", startedAtLocal: "2026-09-25T09:15", durationSeconds: 285, phone: "9000000020",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Pallavi. I have a 2BHK in Magarpatta, about 900 sq ft. We've wanted to design it properly for a while: kitchen, both bedrooms and living room.
Agent: When would you like to start?
Caller: We're not fixed on it. Starting execution in January would be perfect.
Agent: Are you the owner?
Caller: Yes, my husband and I, and we both want to attend the consultation.
Agent: Shall I book that now?
Caller: Please. Friday evening works. My number is 9000000020.`,
    expected: { tier: "green" },
  },
  {
    id: "T17a", startedAtLocal: "2026-09-22T14:14", durationSeconds: 72, phone: "9000000017",
    transcript: `Agent: Hello, this is Aangan Studio's assistant. May I have your name?
Caller: Hi, I wanted to enquire about, (line drops)`,
    expected: { tier: "dropped" },
    note: "Extra case (not in the 20): first half of the T17 pair, call dropped before any details.",
  },
];
