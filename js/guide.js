// Case design guide. Summarised from the official Case Design Guide (Van Ryder Games) in our own words.
const step = (s, label) => `<a class="btn small" href="#/build/${s}">${label}</a>`;

export const GUIDE = [
  {
    id: 'start', title: 'Before you start', html: `
<p>Writing a case is closer to designing a new game than writing a short story. The game's designer puts a decent case at around <strong>40 hours of work</strong> before the first playtest, and every playtest will expose holes that need rewriting. Because a group can only solve a mystery once, each new version needs a fresh group of testers.</p>
<p>Play a good number of the published cases first. You need to know how the Chisel, leverage and Solve tokens feel at the table, and the examples in the official guide spoil several cases.</p>
<p>For a first case, keep it simple: <em>suspect X killed victim Y because of motive Z</em>. Twists such as two killers, an unknown victim or a ticking bomb can come later.</p>
<div class="note"><strong>This tool replaces the image editing.</strong> The official kit expects you to lay text over the card images in an image editor. Here you type the text, pick kit art or upload your own pictures, and print finished sheets at actual size.</div>`,
  },
  {
    id: 'anatomy', title: 'What a case is made of', html: `
<dl class="anatomy">
<dt>Detective briefing</dt><dd>The opening page read to the detectives: what happened, who the public suspects are, setup instructions, how to solve the case and any special rules.</dd>
<dt>Case cards (A to L)</dt><dd>The backbone. Up to <strong>12</strong>, no minimum. Four kinds: the <strong>victim or crime</strong>, <strong>suspects</strong> (no more than <strong>5</strong> is the recommendation), <strong>evidence</strong> and <strong>information</strong>. Detectives question suspects about Case cards.</dd>
<dt>Search cards</dt><dd>Read when a detective searches a suspect or a location. This is how hidden evidence and hidden suspects turn up. One card per searchable place or person. An interrogation-heavy case may need under ten; a case about hunting for something can need over thirty.</dd>
<dt>Response cards and the Chisel grid</dt><dd>Every answer each suspect can give to every question. Usually one <strong>most useful response</strong> and one <strong>lie or misdirection</strong> per question. Budget roughly <code>Case cards x suspects x 2</code> responses: 12 cards and 4 suspects is about 96.</dd>
<dt>Mystery cards</dt><dd>Like Case cards, but normally not asked about. Use them for twists and special rules, or to replace a Case card mid-game (an "unknown murder" that becomes a named victim).</dd>
<dt>Epilogue</dt><dd>The reveal read at the end, so everyone learns what really happened.</dd>
</dl>
<p>Expect <strong>3,000 to 5,000 words</strong> across the briefing, responses, Search cards and epilogue. The shortest published case has about 2,000; the longest about 5,300.</p>`,
  },
  {
    id: 'rules', title: 'The three golden rules', html: `
<ol class="rules">
<li><strong>Everything makes logical sense.</strong> At the epilogue players should say "so that's what happened", not "huh?". If the weapon is at a location, there is a reason it got there. Hint at the killer's motive in their answers.</li>
<li><strong>The fun is solving the mystery.</strong> A case nobody can crack is no fun. If nobody solves it, they should at least get close. Frustrated players are the clearest sign a case is too hard or too obscure.</li>
<li><strong>Everyone has something to hide.</strong> Every suspect needs a dirty secret or a reason to want the victim dead. Innocent witnesses give the Chisel nothing to play with and are easy to rule out.</li>
</ol>`,
  },
  {
    id: 'story', title: 'Step 1: outline the story and the solution', html: `
<p>Write a short, high-level outline: the beats of what really happened, then the solution (suspect, weapon, motive). Fifteen minutes of bullet points is enough to start.</p>
<ul>
<li>Make the crime look like something it is not: a murder staged as a suicide or an accident.</li>
<li>Give every suspect a way they could be guilty. Tangled relationships between suspects make richer cases.</li>
<li>Select <strong>every</strong> motive that genuinely applies, not just one.</li>
<li>Stuck for ideas? Browse the 20 suspect portraits and 16 pieces of evidence in the kit art.</li>
</ul>
<p>Come back and revise the outline as the case grows. It becomes your case bible.</p>
<p>${step('story', 'Open story and solution')}</p>`,
  },
  {
    id: 'city', title: 'Step 2: plan the city', html: `
<p>Decide where each suspect, piece of evidence and lead sits on the map.</p>
<ul>
<li>The more districts you spread across, the harder the case. Keep the important action to <strong>four districts at most</strong>, one of them Central L.A.</li>
<li>Movement is the least fun part of the game. If important places are far apart, players spend their actions walking instead of asking questions.</li>
<li>Spots on a district border reach both districts in one move, which makes them handy hubs.</li>
<li>Moving things further apart is one way to raise difficulty, but not a good one.</li>
</ul>
<p>${step('city', 'Open the city planner')}</p>`,
  },
  {
    id: 'cards', title: 'Step 3: fill in the Case cards', html: `
<p>List what the detectives know at the start (face up) and what they must discover (hidden).</p>
<ul>
<li>Include <strong>at least two possible murder weapons</strong>. With only one, players know the answer once they have seen every card.</li>
<li><strong>Information</strong> cards hold key facts ("X was blackmailing Y") that open new lines of questioning.</li>
<li>Think about where each hidden card is found. Put it somewhere that makes sense, and not where it is too easy to connect the dots.</li>
<li>Don't spend a Case card on something that only points to a location. A Search card can carry that lead.</li>
</ul>
<p>${step('cards', 'Open the Case cards')}</p>`,
  },
  {
    id: 'guesses', title: 'Step 4: alternate guesses and unanswered questions', html: `
<p>Before writing responses, list two things.</p>
<p><strong>Alternate guesses</strong> are wrong solutions that look plausible (suspect, weapon, motive). Lies and misdirections that steer toward these give the Chisel great choices.</p>
<p><strong>Unanswered questions</strong> are the leads players don't start with. "How will they learn about the safe deposit box?" Most get answered inside responses, so keep the list in view while writing.</p>
<p>${step('story', 'Open alternate guesses')}</p>`,
  },
  {
    id: 'responses', title: 'Step 5: write the responses', html: `
<p>This is the longest part. Write responses before the briefing and epilogue, because the case will shift as you discover how each suspect answers.</p>
<ul>
<li><strong>Most useful response</strong>: exactly one per suspect per question, and it is always true. It is not called "the truth" because lies can be true too.</li>
<li><strong>Lie or misdirection</strong>: not every suspect has one for every question, and some have several. The best misdirections are true statements that point away from what the suspect is hiding.</li>
<li><strong>The guilty suspect never directly implicates themselves.</strong> Innocent suspects can say "it wasn't me". Start with the killer's answers about the victim and the weapon; they are the hardest and the most important. The killer can have several lies about the victim to give the Chisel room.</li>
<li>A response that lets a detective <strong>look at a Case card</strong> is powerful: players tend to trust whatever came with it.</li>
<li>Stay in character. If a suspect has never seen an item, they have one honest answer and no lie.</li>
<li>Write the true answer, then ask whether it hands over too much. Make it vaguer, angrier or more evasive until it is suspicious but not a confession.</li>
</ul>
<p>The tool numbers the responses for you in Chisel grid order (1a, 1b, 1c, 1d, 1w, 1x, 1y, 1z, 2a ...) and lays them out on Response cards.</p>
<p>${step('responses', 'Open the responses')}</p>`,
  },
  {
    id: 'search', title: 'Step 6: write the Search cards', html: `
<p>Make an inventory of every suspect and every location that could logically be searched, including red herrings mentioned in a lie.</p>
<ul>
<li>Write the <strong>archived</strong> ones first: found suspects and removed evidence. Those can only be read once, then the place cannot be searched again.</li>
<li>Cards that are not archived get read by several detectives. Write them so the same thing can happen again ("she snatches the receipt back").</li>
<li>Search cards can answer your unanswered questions directly, saving a Case card.</li>
</ul>
<p>${step('search', 'Open the Search cards')}</p>`,
  },
  {
    id: 'checks', title: 'Step 7: hunt for choke points and early solves', html: `
<p>A <strong>choke point</strong> is a vital lead reachable by only one action. If nobody happens to ask that one suspect that one question, the case becomes unsolvable, and players feel cheated. Give every key lead two or three routes: another suspect knows it, it is on a Search card, or a partial clue sits on a Case card.</p>
<p>An <strong>early solve</strong> happens when the weapon is face up or easy to grab on the first turn, so a lucky guess wins on day two. Bury the weapon a few layers deep so the case cannot be solved until the twists are uncovered. (An easy, Gumshoe-level case can relax this.)</p>
<p>The checks page flags hidden cards with a single route, weapons that start face up, locations with no Search card and more.</p>
<p>${step('checks', 'Run the checks')}</p>`,
  },
  {
    id: 'epilogue', title: 'Step 8: write the epilogue', html: `
<p>Turn the outline into the reveal. The best epilogues peel the case back layer by layer: was it her? No. Him? He looked guilty, but no. Save the killer for the final paragraph, and tie off the details players missed.</p>
<p>${step('epilogue', 'Open the epilogue')}</p>`,
  },
  {
    id: 'briefing', title: 'Step 9: write the briefing', html: `
<p>Write it last, from the briefing notes in your outline. The published cases use the voice of a gruff police captain, but you can experiment.</p>
<ul>
<li>Every game starts with all Case cards face down. Put setup in brackets at the right moment: "(flip Case card A)", "(place the crime scene marker at 43)", "(place Alice's standee at 8)".</li>
<li>State the win condition. Almost always: identify the guilty SUSPECT, the murder WEAPON and the MOTIVE.</li>
<li>List the <strong>locations of interest</strong> mentioned in the briefing so detectives can find them in one place.</li>
<li>Add any special rules.</li>
</ul>
<p>${step('briefing', 'Open the briefing')}</p>`,
  },
  {
    id: 'playtest', title: 'Step 10: print, playtest, revise', html: `
<p>Print everything, cut it out, and run the case as the Chisel. Take notes on:</p>
<ul>
<li>Responses that confuse players or don't say what you meant.</li>
<li>Moments you wished you had another lie to give.</li>
<li>Leads players never uncover, and choke points you missed.</li>
<li>Too much walking, not enough questioning.</li>
<li>When Solve tokens get spent. Day 2 or 3 is far too early.</li>
<li>Reactions to the epilogue: "aha" or "huh".</li>
</ul>
<p>Revise while it is fresh, then find a new group. When it runs well, share it with the Detective: City of Angels community. Fan cases may not be sold or exchanged for money without Van Ryder Games' written permission.</p>
<p>${step('print', 'Open printing')}</p>`,
  },
  {
    id: 'tips', title: 'Using this tool', html: `
<ul>
<li>Everything is saved in this browser as you type. Use <strong>Cases &gt; Back up</strong> to save a file you can move to another device or share. Pictures are included.</li>
<li>Case card letters follow the order of the cards. Reorder them and every reference updates.</li>
<li>Write location numbers in brackets, like <code>(34)</code>. The checks use them to find missing Search cards and choke points.</li>
<li>Wrap words in double asterisks for bold: <code>**not happy**</code>.</li>
<li>Response codes and Response cards are generated. Turn on "start each suspect on a new card" to keep a suspect's answers together, and portraits to show their face on the card.</li>
<li>Print at 100% (actual size). For double-sided cards, print the backs page on the reverse and flip on the long edge.</li>
</ul>`,
  },
];
