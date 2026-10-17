import type { Lang } from './types'

/** 3D models by the statue's Wikidata item. */
export const MODELS: Record<string, { src: string }> = {
  // Warrior on Horseback (Alexander the Great), Macedonia Square
  Q3497603: { src: '/models/warrior-on-horseback.glb' },
}

/**
 * Original bilingual stories shared by the visible biography and spoken guide.
 * Alexander: biography and campaign chronology checked against
 * https://en.wikipedia.org/wiki/Alexander_the_Great
 * Bucephalus anecdote (explicitly presented as Plutarch's later account):
 * https://sourcebooks.web.fordham.edu/ancient/plutarch-alexander1.asp
 * Cultural legacy and successor kingdoms:
 * https://www.metmuseum.org/essays/art-of-the-hellenistic-age-and-the-hellenistic-tradition
 * The closing reading of the pose is interpretation, not a claim of the sculptor's intent.
 */
export const NARRATION: Record<string, Record<Lang, string>> = {
  Q3497603: {
    en: `Look up at the rider above Macedonia Square. The monument is called Warrior on Horseback, but the figure it evokes is Alexander the Third of Macedon, remembered as Alexander the Great. To understand the raised sword and the restless horse, we need to look beyond the bronze and meet the young king behind the image.

Alexander was born in Pella in 356 before the common era, the son of Philip the Second and Olympias. He grew up in the royal court of ancient Macedonia, where education and preparation for command went together. The philosopher Aristotle was one of his teachers. When Philip was assassinated in 336, Alexander became king at just twenty, inheriting an experienced army and a kingdom his father had made powerful.

The horse brings another part of his story into view: Bucephalus. Writing centuries later, Plutarch tells how the young Alexander noticed that a horse nobody could ride was frightened by its own shadow. He turned it towards the sun, calmed it and mounted it. This is an ancient anecdote rather than an eyewitness record. Its enduring appeal is the idea that courage can begin with understanding what others have overlooked.

In 334, Alexander crossed into Asia to fight the Persian Empire. Victories at Issus and, in 331, Gaugamela broke the power of King Darius the Third. His campaigns carried Macedonian forces through Egypt, Persia and onwards to the Indian subcontinent. The distances are striking: imagine leaving home on foot or horseback and spending years travelling and fighting thousands of kilometres away. His soldiers eventually refused to march farther east, and he turned back.

His influence reached beyond the battlefield. The conquests brought distant regions into closer contact, and Greek language and art spread alongside exchanges with local traditions. After his death, the kingdoms ruled by his successors became centres of the Hellenistic world. This was also an age built on warfare and domination; cultural exchange did not erase the suffering that conquest brought.

Alexander died in Babylon in 323, aged thirty-two. His empire did not remain united: his successors fought over it and formed rival kingdoms. The contrast is remarkable—a short life, a fragile political inheritance, and a reputation that has lasted more than two thousand years.

Now look again at the monument. One way to read the raised sword and rearing horse is as an image of ambition, movement and command. The still bronze holds a moment of action. It invites us to remember both Alexander's extraordinary reach and the limits of power: what can one person change, and what survives after that person is gone?`,
    mk: `Погледнете го коњаникот над плоштадот Македонија. Споменикот се нарекува „Воин на коњ“, а ликот на кој нè потсетува е Александар Трети Македонски, познат и како Александар Велики. За да ги разбереме кренатиот меч и немирниот коњ, треба да погледнеме зад бронзата и да го запознаеме младиот крал зад оваа слика.

Александар е роден во Пела во 356 година пред нашата ера, како син на Филип Втори и Олимпијада. Растел во кралскиот двор на античка Македонија, каде што образованието и подготовката за воено водство оделе заедно. Еден од неговите учители бил филозофот Аристотел. Кога Филип бил убиен во 336 година, Александар станал крал на само дваесет години. Наследил искусна војска и кралство што неговиот татко го направил моќно.

Коњот нè води кон уште еден дел од неговата приказна: Букефал. Пишувајќи векови подоцна, Плутарх раскажува дека младиот Александар забележал оти коњот што никој не можел да го јава се плаши од сопствената сенка. Го свртел кон сонцето, го смирил и го јавнал. Ова е античка анегдота, а не сведоштво на очевидец. Нејзината трајна привлечност е во мислата дека храброста може да почне со разбирање на нешто што другите не го забележале.

Во 334 година Александар преминал во Азија за да војува против Персиското Царство. Победите кај Ис и, во 331 година, кај Гавгамела ја скршиле моќта на кралот Дариј Трети. Неговите походи ги одвеле македонските сили низ Египет, Персија и до Индискиот Потконтинент. Замислете да тргнете од дома пеш или на коњ и со години да патувате и да се борите илјадници километри далеку. На крајот неговите војници одбиле да продолжат понатаму кон исток, па тој се вратил назад.

Неговото влијание се протегало и надвор од бојното поле. Освојувањата зближиле далечни области, а грчкиот јазик и уметност се ширеле преку заемни влијанија со локалните традиции. По неговата смрт, кралствата на неговите наследници станале средишта на хеленистичкиот свет. Но тоа било и време на војни и потчинување: културната размена не ги избришала страдањата што ги носеле освојувањата.

Александар починал во Вавилон во 323 година, на триесет и две години. Неговото царство не останало обединето. Наследниците се бореле за него и создале сопернички кралства. Токму тука е впечатливиот контраст: краток живот, кревко политичко наследство и слава што трае повеќе од две илјади години.

Сега погледнете го споменикот повторно. Кренатиот меч и исправениот коњ можеме да ги читаме како слика на амбиција, движење и водство. Неподвижната бронза задржува миг на дејствување. Таа нè повикува да се сетиме и на огромниот дострел на Александар и на границите на моќта: што може да промени еден човек, и што останува по него?`,
  },
}
