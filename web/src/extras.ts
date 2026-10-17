import type { DataLang } from './types'

/** 3D models by the statue's Wikidata item. */
export const MODELS: Record<string, { src: string }> = {
  // Warrior on Horseback (Alexander the Great), Macedonia Square
  Q3497603: { src: '/models/warrior-on-horseback.glb' },
}

/**
 * Tour-guide narration written for the headline statues, from the statue's and the person's
 * Wikipedia articles (EN "Warrior on Horseback", MK "Воин на коњ (Скопје)", "Alexander the Great").
 * Other statues are narrated from their Wikipedia summary.
 */
export const NARRATION: Record<string, Record<DataLang, string>> = {
  Q3497603: {
    en: `Welcome to Macedonia Square. Look up: the rider on the rearing horse is the Warrior on Horseback, the centrepiece of Skopje's main square. The bronze figure is about twelve metres tall and stands on a ten-metre column, and the whole monument is also a fountain. It was sculpted by Valentina Stevanovska, cast in Florence, Italy, and unveiled on the eighth of September 2011, twenty years after the country's independence referendum.
Officially it is simply a warrior, but everyone in Skopje knows who it shows: Alexander the Great. Alexander was born in Pella in 356 BC, the son of King Philip the Second and Olympias. As a boy he was taught by the philosopher Aristotle. He became king at twenty, and by thirty he had built one of the largest empires in history, stretching from Greece to northwestern India, and he never lost a battle. He died in Babylon in 323 BC, at just thirty-two.
Walk around the fountain: eight bronze soldiers and eight lions guard the base, and the rings on the column show three battles. Then look across the river: his father, Philip the Second, is waiting for you on the other side.`,
    mk: `Добредојдовте на плоштадот Македонија. Погледнете нагоре: коњаникот на исправениот коњ е „Воин на коњ“, срцето на главниот плоштад во Скопје. Бронзената фигура е висока четиринаесет и пол метри и стои на столб висок десет метри, а целиот споменик е и фонтана. Автор е вајарката Валентина Стефановска, изработен е во Фиренца, Италија, а свечено е отворен на осми септември 2011 година, дваесет години по прогласувањето на независноста.
Официјално е „воин“, но секој во Скопје знае кого прикажува: Александар Македонски. Александар е роден во Пела во 356 година пред нашата ера, син на кралот Филип Втори и Олимпијада. Како момче учел кај филозофот Аристотел. Крал станал на дваесет години, а до триесеттата создал една од најголемите империи во историјата, од Грција до северозападна Индија, без да изгуби ниту една битка. Починал во Вавилон во 323 година пред нашата ера, на само триесет и две години.
Прошетајте околу фонтаната: осум бронзени војници и осум лавови ја чуваат основата, а прстените на столбот прикажуваат три битки. Потоа погледнете преку реката: таму ве чека неговиот татко, Филип Втори.`,
  },
}
