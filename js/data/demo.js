// A short example case, written for this tool. Shows every part of a case.
import { newCase, newCard, newSearch, newResponse, uid } from '../model.js?v=202611261456';

export function demoCase() {
  const c = newCase('The Last Encore');
  c.caseId = 'CB-01';
  c.author = 'Ivan & Claude';
  c.difficulty = 'Gumshoe';
  const card = (type, name, role, text, src, extra = {}) => {
    const k = newCard(type);
    Object.assign(k, { name, role, text, ...extra });
    k.image.src = src;
    c.cards.push(k);
    return k;
  };
  const A = card('victim', 'Lenny "Sugar" Vance', 'The victim', 'Trumpet player at Slapsy Maxie\'s. Found cold in his hotel room with an empty bottle of **sleeping pills**.', 'kit:Male_Shady', { faceUp: true, foundAt: 32 });
  const B = card('suspect', 'Vera Lane', 'Nightclub singer', 'Sings with Lenny\'s band. Her mascara says she has been crying. Her eyes say she is **calculating**.', 'kit:Female_Singer', { faceUp: true, foundAt: 26 });
  const C = card('suspect', 'Dr. Harold Pike', 'Physician', 'Pressed suit, steady hands, and a habit of checking his watch while **you** talk.', 'kit:Male_Doctor', { foundAt: 54 });
  const D = card('suspect', 'Sal Moretti', 'Club manager', 'Runs the floor at Slapsy Maxie\'s for people who prefer not to be named. **Not** a patient man.', 'kit:Male_Gangster', { faceUp: true, foundAt: 9 });
  const E = card('evidence', 'Rat poison', '', 'A dented tin of strychnine rat poison. Half empty. The lid has been wiped clean.', 'kit:RatPoison', { foundAt: 48, weapon: true });
  const F = card('evidence', 'Chloroform', '', 'A small brown bottle of chloroform wrapped in a silk handkerchief embroidered "V".', 'kit:Chloroform', { foundAt: 26, weapon: true });
  const G = card('info', 'Pike blackmail', '', 'Lenny was blackmailing Dr. Pike.', '');

  c.outline = [
    '- Lenny Vance, trumpet player, is found dead in his room at the Frostonya Apartment Hotel (32). It looks like he swallowed a bottle of sleeping pills.',
    '- Lenny got his pills from Dr. Harold Pike, who also writes prescriptions for Moretti\'s people. Lenny found out and blackmailed Pike.',
    '- Vera Lane is leaving the band for a record deal. Lenny threatened to tell the label about her past. She keeps chloroform for her "migraines" and to calm the club girls; it is a red herring.',
    '- Sal Moretti is owed $2,000 by Lenny and threatened him in front of the band the night before.',
    '- Pike visited Lenny that night "to bring more pills", laced his gin with strychnine, and left the sleeping pills behind to make it look like suicide.',
    '- Pike took the poison tin back to his office in the Bradbury Building (48).',
  ].join('\n');
  c.solution = { suspect: C.id, weapon: E.id, motives: ['To Keep a Secret', 'Money/Greed'] };
  c.alternates = [
    { suspect: D.id, weapon: E.id, motives: ['Mob Related', 'Money/Greed'], note: 'Moretti publicly threatened Lenny over the debt.' },
    { suspect: B.id, weapon: F.id, motives: ['To Keep a Secret', 'Revenge'], note: 'Vera had the most to lose and the chloroform is hers.' },
  ];
  c.questions = [
    { text: 'How will players find Dr. Pike?', by: 'Vera on Lenny (lie), Moretti on Lenny, search (32)', done: true },
    { text: 'How will players learn about the Bradbury Building office (48)?', by: 'Moretti on Pike, search of Pike', done: true },
  ];
  c.places = [
    { loc: 32, what: 'Crime scene, Lenny\'s room', kind: 'crime' },
    { loc: 26, what: 'Vera Lane', kind: 'suspect' },
    { loc: 9, what: 'Sal Moretti', kind: 'suspect' },
    { loc: 54, what: 'Dr. Pike', kind: 'suspect' },
    { loc: 48, what: 'Pike\'s office, rat poison', kind: 'evidence' },
    { loc: 22, what: 'Red herring', kind: 'herring' },
  ];

  const R = (s, k, kind, text, look = '') => {
    c.responses[s.id] = c.responses[s.id] || {};
    const list = c.responses[s.id][k.id] = c.responses[s.id][k.id] || [];
    const r = newResponse(kind); r.text = text; r.look = look; list.push(r);
  };
  // Vera
  R(B, A, 'useful', '"Lenny could play like an angel and lie like the devil. He had something on half this town, detective." She looks away. "Me included."');
  R(B, A, 'lie', '"He was sick. His doctor kept him on pills just to sleep. Some quack up at L.A. General (54)." She dabs her eyes.');
  R(B, A, 'lie', '"Ask Sal Moretti what he said to Lenny the night before. In front of the whole band."');
  R(B, B, 'useful', '"I signed with a record label last week. Lenny didn\'t take it well. That\'s not a crime."');
  R(B, C, 'useful', '"Pike? Lenny\'s doctor. Came to the club with a black bag full of something for everybody."');
  R(B, D, 'useful', '"Sal is all bark. He wanted his money, and a dead man doesn\'t pay."');
  R(B, D, 'lie', '"Sal told Lenny he\'d end up face down in the Stag & Bull (22) if he didn\'t pay up."');
  R(B, E, 'useful', '"Rat poison? Detective, I sing for a living. I don\'t even cook."');
  R(B, F, 'useful', 'She goes pale. "It helps my headaches. A few drops on a handkerchief. I never gave Lenny a drop of it."');
  R(B, F, 'lie', '"That\'s not mine. Half the girls at Maxie\'s use it to sleep. Ask Sal where he gets it."');
  R(B, G, 'useful', '"So that\'s why Pike kept coming around. Lenny said the doctor would pay for his new horn."');
  // Pike
  R(C, A, 'useful', '"A tragic case. He relied on barbiturates to sleep. I warned him about mixing them with gin." He checks his watch.');
  R(C, A, 'lie', '"Lenny owed money to the worst people in this city. I would look at the company he kept at Slapsy Maxie\'s (9)."');
  R(C, B, 'useful', '"Miss Lane was afraid of him. I don\'t blame her."');
  R(C, C, 'useful', '"I treat musicians, detective. Long nights, bad habits. I keep an office in the Bradbury Building, if you need a professional opinion."');
  R(C, D, 'useful', '"Moretti pays his bills. That\'s all I know about him."');
  R(C, D, 'lie', '"Moretti asked me once what dose of sleeping pills would stop a man\'s heart. I refused to answer, of course."');
  R(C, E, 'useful', 'He studies the tin a moment too long. "Common enough. Every cellar in the city has one. Where did you say you found it?"');
  R(C, E, 'lie', '"Strychnine? Then it wasn\'t the pills at all. I\'d look at whoever poured his drinks."');
  R(C, F, 'useful', '"Chloroform. Useless as a poison by mouth. Whoever owns that wanted someone quiet, not dead."');
  R(C, G, 'useful', '"Ridiculous." His jaw tightens. "I have nothing to hide and I\'ll say nothing more without my lawyer."');
  // Moretti
  R(D, A, 'useful', '"Lenny owed me two grand. You think I\'d kill a guy who owes me money? Ask his sawbones, Pike. They were thick as thieves."');
  R(D, A, 'lie', '"Musicians. They all end up the same way. Pills, gin, a cheap room."');
  R(D, B, 'useful', '"Vera\'s leaving for some record label. Lenny swore he\'d sink her first."');
  R(D, C, 'useful', '"Pike? He writes prescriptions for my boys, no questions asked. Office up in the Bradbury Building (48)."');
  R(D, C, 'lie', '"Never heard of him."');
  R(D, D, 'useful', '"I said things to Lenny I shouldn\'t have. Doesn\'t mean I did anything."');
  R(D, E, 'useful', '"We got rats at the club. We got traps for that. Never seen this tin."');
  R(D, F, 'useful', '"That\'s Vera\'s. She keeps it in her purse. Says it\'s for headaches."');
  R(D, G, 'useful', '"Ha! Lenny had guts. Pike must have been sweating bullets."');
  R(D, G, 'lie', '"Lenny squeezed everybody. Including Vera. Did you know that?"', B.id);

  const S = (kind, ref, text, action = 'none', target = '', extra = {}) => {
    const s = newSearch(kind);
    if (kind === 'location') s.loc = ref; else { s.suspect = ref; s.image.src = 'suspect'; }
    Object.assign(s, { text, action, target, ...extra });
    c.search.push(s);
    return s;
  };
  S('suspect', B.id, 'She lets you look through her purse with a bored sigh. Lipstick, a contract from a record label and a little brown bottle in a silk handkerchief.', 'take', F.id, { archive: true });
  S('suspect', C.id, 'His black bag holds the usual: stethoscope, sleeping pills, a prescription pad and a key ring with a tag for an office in the Bradbury Building (48). He takes the keys back.');
  S('suspect', D.id, 'Moretti spreads his arms. "Go ahead." A roll of bills, a pistol permit and a betting slip. Nothing you can use.');
  S('location', 32, 'Lenny\'s room smells of gin. An empty pill bottle on the nightstand is labelled "Dr. H. Pike, L.A. General (54)". Under the mattress, a notebook of payments: "H.P. $200".', 'take', G.id, { archive: true });
  S('location', 26, 'Vera\'s suite is all packed boxes and train timetables. Somebody is leaving town in a hurry.');
  S('location', 9, 'The band is rehearsing without a trumpet. The bartender says Moretti and Lenny shouted at each other two nights ago. "Then Lenny\'s doctor came by and calmed him down."');
  S('location', 54, 'The nurse at the front desk points you down the corridor to a man in a pressed suit, checking his watch.', 'place', C.id, { place: 54, archive: true });
  S('location', 48, 'Pike\'s office is neat as a pin. In the bottom drawer, behind the medical journals, is a dented tin of rat poison.', 'take', E.id, { archive: true });
  S('location', 22, 'The Stag & Bull is empty at this hour. The barman has never heard of Lenny Vance and would like you to leave.');

  c.briefing.body = [
    'Sit down and listen, because I\'m only saying this once. At six this morning a maid at the Frostonya Apartment Hotel (32) found a trumpet player named Lenny "Sugar" Vance stone dead in his room (flip Case card A and place the crime scene marker at 32).',
    'An empty bottle of sleeping pills says suicide. The coroner says the man\'s jaw was clenched like a bear trap. Sleeping pills don\'t do that.',
    'Lenny played at Slapsy Maxie\'s (9) for Sal Moretti (flip Case card D and place Moretti\'s standee at 9). Word is Lenny owed him money and Sal is not the forgiving type.',
    'His singer, Vera Lane, is holed up at the Chateau Marmont (26) (flip Case card B and place Vera\'s standee at 26). She was the last of the band to see him alive.',
    'Find out who did it before the papers do.',
  ].join('\n');
  c.briefing.locations = [
    { loc: 32, name: 'Frostonya Apartment Hotel', label: 'Crime scene' },
    { loc: 9, name: '', label: 'Sal Moretti' },
    { loc: 26, name: '', label: 'Vera Lane' },
  ];
  c.briefing.special = 'None. This is an example case made with Case Builder.';
  c.epilogue = [
    'Vera Lane had reasons. Lenny swore he would ruin her record deal, and the chloroform in her purse looked bad. But chloroform puts people to sleep; it doesn\'t lock their jaws.',
    'Sal Moretti had reasons too. Two thousand of them. But dead men don\'t pay their debts, and Sal knew it.',
    'The man with the most to lose was the one who walked in carrying a black bag. Lenny had found out that Dr. Harold Pike wrote prescriptions for Moretti\'s men, and he wanted $200 a week to keep quiet.',
    'That night Pike brought Lenny a fresh bottle of sleeping pills and poured him a gin laced with strychnine. He left the empty pill bottle on the nightstand and took the tin back to his office in the Bradbury Building.',
    'Dr. Harold Pike killed Lenny Vance with rat poison, to keep his secret and his money.',
  ].join('\n\n');
  void uid; void A;
  return c;
}
