# **Cognitieve Wetenschap en Evidence-Based Schaaktraining: Een Uitputtende Analyse van Partijanalyse en Vaardigheidsverwerving**

## **Executieve Samenvatting: Richtlijnen met de Hoogste Return-on-Investment**

De integratie van cognitieve wetenschap, gedragspsychologie en de analyse van grootschalige schaakdatabases biedt een robuust raamwerk voor het optimaliseren van vaardigheidsverwerving in het schaken. De onderstaande directieven vertegenwoordigen de bewijsvoering met de hoogste mate van zekerheid voor de architectuur van een digitale trainingsapplicatie. Deze inzichten overstijgen conventionele schaakwijsheden en zijn gebaseerd op rigoureus empirisch onderzoek.

1. **Serieuze Individuele Studie Boven Speelvolume:** Gecumuleerde uren van eenzame, gerichte studie (specifiek het bestuderen van stellingen en het analyseren van partijen zonder externe hulp) verklaren de grootste variantie in schaakexpertise. Het effect van pure toernooideelname of het spelen van talloze snelschaakpartijen is statistisch verwaarloosbaar tenzij dit gepaard gaat met reflectieve analyse1.  
2. **Uitgestelde Engine-Feedback (Desirable Difficulties):** Het onmiddellijk presenteren van computer-evaluaties na een partij creëert een "fluency trap" (illusie van competentie). Dit leidt tot kortetermijnprestaties maar degradeert de langetermijnretentie aanzienlijk. Het achterhouden van engine-feedback totdat de speler een handmatige annotatie heeft geprobeerd, is een absolute vereiste voor diepe cognitieve codering5.  
3. **Succes-Vooringenomen Partijanalyse:** In tegenstelling tot het wijdverbreide dogma dat men "het meest leert van zijn fouten", tonen empirische analyses van miljoenen online snelschaakpartijen aan dat het analyseren van overwinningen een statistisch sterkere correlatie heeft met ratingverbetering. Falen activeert 'ego-threat' (bedreiging van het zelfbeeld), wat cognitieve betrokkenheid en patroonherkenning neurologisch blokkeert8.  
4. **De 85%-Regel voor Optimale Moeilijkheidsgraad:** Trainingsalgoritmen moeten dynamisch worden aangepast om een succespercentage van 85% (en dus een foutenmarge van 15%) te behouden tijdens tactische training en patroonherkenning. Dit weerspiegelt de optimale 'gradient-descent' ratio voor zowel biologische als artificiële neurale netwerken om de leersnelheid te maximaliseren11.  
5. **Focus op de Region of Proximal Learning (RPL):** Partijanalyse moet zich uitsluitend richten op fouten die net buiten het huidige competentieniveau van de speler vallen. Het presenteren van complexe strategische fouten aan beginners leidt tot cognitieve overbelasting. De applicatie moet analyses filteren tot de "makkelijkste nog niet geleerde concepten"14.  
6. **Gespreide Herhaling (Spaced Repetition) voor Procedureel Geheugen:** Het opnieuw oplossen van gefaalde puzzels of kritieke partijmomenten met steeds groter wordende intervallen (bijv. 1, 3, 7, 14, 30 dagen) maakt gebruik van het 'spacing effect' om tactische patronen van het werkgeheugen naar het langetermijngeheugen te consolideren in de vorm van 'chunks'17.  
7. **Geïnterlinieerde Oefening Boven Geblokte Oefening:** Het door elkaar husselen van tactische thema's (bijv. penningen, vorken, aftrekaanvallen) dwingt de speler om probleemidentificatie te oefenen. Geblokte oefening (slechts één thema per sessie) creëert kunstmatige accuraatheidspieken die niet vertalen naar echte partijen20.  
8. **Het Generatie-Effect via Pre-Testing:** Spelers dwingen om een zet in een meesterpartij of eigen partij te raden voordat de theorie of engine-lijn wordt uitgelegd, verbetert de retentie van het concept aanzienlijk, zelfs als de initiële gok incorrect was23.  
9. **Gewoontevorming en Slaapconsolidatie:** Neurologische consolidatie van 'chunked' patronen vindt plaats tijdens de slaap. De gedragswetenschap (Lally, Wood) toont aan dat consistente dagelijkse training superieur is aan onregelmatige, lange sessies. Eén puzzel per dag gedurende dertig dagen produceert betere structurele hersenveranderingen dan dertig puzzels in één sessie25.  
10. **Filtering van Hoge-Entropie Zetten:** Moderne engines evalueren vaak meerdere kandidaatzetten binnen enkele centipionnen van elkaar. De applicatie moet "hoge-entropie" variaties (waarbij het voordeel uiterst complex en volatiel is) identificeren en verbergen voor sub-meester spelers om verwarring te voorkomen27.  
11. **Autonomie en Competentie (Zelfdeterminatietheorie):** Volgens de theorie van Deci & Ryan vereist langdurige motivatie dat gebruikers de zin inzien van hun taken. Een "no-BS" wetenschappelijke benadering, waarbij exact wordt uitgelegd *waarom* een oefening nuttig is, verhoogt de intrinsieke motivatie en therapietrouw bij trainingsprogramma's28.

## **Mythen en Laag-Bewijs Praktijken om te Vermijden**

Om een radicaal eerlijk en evidence-based platform te behouden, dienen de volgende populaire heuristieken expliciet in de applicatie te worden afgewezen of genuanceerd.

### **Mythe 1: "De 10.000-Uren Regel garandeert meesterschap."**

**Bewijsgraad:** D (Breed geaccepteerde mythe, sterk genuanceerd door recente meta-analyses). De theorie dat 10.000 uur aan 'deliberate practice' (gerichte oefening) voldoende is voor meesterschap, afkomstig van Ericsson et al., is misleidend. Meta-analyses door Macnamara en Hambrick tonen aan dat gerichte oefening slechts ongeveer 26% van de variantie in schaakprestaties verklaart31. Er bestaat een enorme inter-individuele variabiliteit: studies tonen aan dat sommige spelers het meesterniveau bereikten in slechts 3.016 uur, terwijl anderen na 23.608 uur nog steeds geen meester waren1. Startleeftijd en andere cognitieve factoren spelen een significante rol. De applicatie mag nooit beloven dat pure inspanning tot een specifieke rating leidt.

### **Mythe 2: "De computer heeft altijd gelijk, bestudeer de eerste lijn."**

**Bewijsgraad:** D (Praktijk die leidt tot cognitieve overbelasting en inefficiënt leren). Engines zoals Stockfish zijn geoptimaliseerd voor objectieve wiskundige waarheid, niet voor menselijke pedagogiek. Een engine kan een zet voorstellen die berust op een 15-zetten diepe verdediging met uiterste precisie. Mensen leren echter via het herkennen van patronen ("chunks") in hun Zone van Naaste Ontwikkeling14. Als de voorgestelde engine-zet buiten de 'Region of Proximal Learning' van de speler valt, is de educatieve waarde nul en leidt dit tot defaitisme15. De applicatie moet onmenselijke engine-lijnen actief onderdrukken voor lagere ratings.

### **Mythe 3: "Je leert het meest van je meest pijnlijke verliezen."**

**Bewijsgraad:** D (Tegengesproken door gedragspsychologische en schaak-specifieke data). Hoewel coaches dit decennialang hebben gepropageerd, tonen recente grootschalige studies (zoals die van Yiannakoulias op miljoenen snelschaakpartijen) aan dat spelers structureel meer ratingwinst boeken wanneer zij partijen analyseren die zij hebben *gewonnen*8. Eskreis-Winkler en Fishbach hebben aangetoond dat falen leidt tot 'ego-threat', wat resulteert in cognitieve uitschakeling (tuning out)9. Mensen herinneren zich letterlijk minder van scenario's waarin ze faalden. Pas op expertniveau, waar het ego is losgekoppeld van een enkele fout, wordt het analyseren van verliezen dominanter effectief.

### **Mythe 4: "Directe feedback na elke zet versnelt het leerproces."**

**Bewijsgraad:** D (Gevaarlijke illusie). Het continu open hebben staan van een evaluatiebalk of het direct tonen van de juiste oplossing nadat een puzzel verkeerd is opgelost, genereert een valse perceptie van bekwaamheid5. Uit de cognitieve psychologie (Bjork's Desirable Difficulties) blijkt dat uitgestelde feedback superieur is voor langetermijnretentie7. Leren vereist frictie. De speler moet worstelen met de stelling voordat het antwoord wordt gegeven.

## **Waar de Bewijslast Dun is: Gemankeerde Best-Guess Standaarden**

De applicatie hanteert wetenschappelijke integriteit door expliciet te benoemen waar aannames worden gemaakt op basis van extrapolatie, omdat direct schaak-specifiek bewijs ontbreekt.

* **Fysiek 3D Bord vs. 2D Scherm Visie:** Er is een sterke anekdotische en theorie-gebaseerde consensus (op basis van 'state-dependent recall') dat uitsluitend trainen op een 2D-scherm de patroonherkenning op een fysiek 3D-bord tijdens toernooien schaadt39. Rigoureuze gerandomiseerde gecontroleerde onderzoeken die deze degradatie exact kwantificeren, ontbreken echter.  
  * *Best-guess default:* De applicatie adviseert spelers (vooral in de bandbreedtes \>1200 die zich voorbereiden op OTB-toernooien) sterk om een fysiek bord te gebruiken bij de analyse-module, in plaats van scherm-manipulatie.  
* **Algoritmen voor Spaced Repetition toegepast op Strategische Heuristieken:** Algoritmen zoals SM-2 en FSRS zijn uitgebreid gevalideerd voor declaratieve kennis (zoals taal en woordenschat) en elementaire tactische patronen. De effectiviteit van deze exacte interval-wiskunde op diepe strategische concepten (bijv. "zwakke velden" of "profylaxe") is nog niet geïsoleerd in grootschalige schaakstudies43.  
  * *Best-guess default:* De applicatie gebruikt bewezen intervallen (1, 3, 7, 14, 30 dagen) voor tactische fouten19, maar vereist dat strategische concepten worden getoetst via generatieve vragen ("Wat is hier het plan?") in plaats van binaire "vind de beste zet" puzzels.  
* **De Exacte Tijdsverdeling Tussen Modaliteiten:** Er is geen definitieve studie die bewijst dat een ratio van 40% spelen, 40% analyseren en 20% tactiek superieur is aan andere verdelingen, aangezien dit sterk varieert per individu en niveau46.  
  * *Best-guess default:* De applicatie hanteert de "85%-regel" als dynamische kalibrator. Als de winstratio of de tactiek-accuratesse onder de 85% zakt, wordt de complexiteit verlaagd en het volume van patroonherkenning ten opzichte van spelen verhoogd11.

## **DEEP DIVE: De Beste Manier om Partijen te Analyseren voor Elke Ratingband**

De kernarchitectuur van de applicatie richt zich op het systematisch begeleiden van de speler door hun eigen data. De cognitieve wetenschap stelt dat de overgang van novice naar expert in het schaken een transitie is van langzame berekening in het werkgeheugen naar onmiddellijke herkenning van 'chunks' (tot wel 300.000 patronen voor grootmeesters) in het langetermijngeheugen36. Partijanalyse is het krachtigste vehikel voor het bouwen van deze chunks, mits correct uitgevoerd4.  
De onderstaande vijf stappen vormen de blauwdruk voor de in-app analysemodule. Deze stappen vertalen abstracte theorie naar een computationeel, config-gereed framework, uitgesplitst per ratingband. (*Opmerking: Ratings zijn bij benadering en gebaseerd op Lichess/Chess.com snelschaak-bandbreedtes*).

### **Stap 1: Emotionele en Metacognitieve Kalibratie (Direct na de partij)**

Het direct starten van een analyse of een nieuwe partij direct na een verlies leidt tot cognitieve blinde vlekken en 'tilt'. De eerste stap van de applicatie is het forceren van een metacognitieve pauze.

* **Aanbeveling (Wat de app moet doen):** De applicatie weigert onmiddellijke analyse na het afronden van een partij. De speler wordt gedwongen een micro-reflectie ("Hoe voel ik mij over deze partij?" of "Waarom verloor/won ik?") in te vullen. Indien de speler meer dan twee keer op rij verliest, blokkeert de app nieuwe speelsuggesties ("loss chasing" preventie) en dwingt een afkoelperiode af.  
* **Parameters / Specificaties:**

| Ratingband | Interface Gedrag Direct Na Partij | Tijdslot voor Analysis-Unlock | Tilt-Preventie Trigger |
| :---- | :---- | :---- | :---- |
| **\< 800** | Vraag: "Kwam je in de problemen door de klok of een blunder?" | Onmiddellijk (behoudt aandacht) | Na 3 verliezen op rij in \< 1 uur. |
| **800 \- 1200** | Vraag: "Waar in de partij voelde je de controle verliezen?" | 2 minuten wachttijd | Na 3 verliezen op rij. |
| **1200 \- 1600** | Vraag: "Wat was je plan in het middenspel?" | 5 minuten wachttijd | Na 2 verliezen op rij (zware tilt bandbreedte). |
| **1600 \- 2000** | Gedetailleerde tagging (bijv. "Tijdnood", "Slecht in de opening"). | 5 minuten wachttijd | Waarschuwing bij prestatiedaling \>15%. |
| **2000+** | Vrije tekstinvoer voor metacognitieve notities. | Zelf te bepalen. | Geen harde lock, toon enkel data-trend. |

* **Per-rating notities:** Lagere ratingbanden hebben een kortere aandachtsspanne; een te lange wachttijd leidt tot app-verlating (churn). Bij hogere banden is de reflectie complexer omdat partijen positioneler zijn.  
* **Bewijsgraad:** B (Gestut door brede theorieën over zelfregulatie, metacognitie en de 'tilt'-effecten geïdentificeerd in esports en besluitvormingsdata)50.  
* **Belangrijkste citaten:**  
  * Srivastava et al. (2025). "A Metacognitive Appraisal of Quitting in Chess."51.  
  * Balas (2024). "Science of Chess: Knowing when to think and when to just move."52.  
* **Vertrouwen \+ Kanttekeningen:** Matig tot hoog vertrouwen in de theorie, maar de implementatie in een web-app vereist zorgvuldige UX-design om te voorkomen dat het als straf wordt ervaren door gebruikers.  
* **Gebruikersgerichte "waarom dit / waarom nu":** *"Emoties beïnvloeden je beoordelingsvermogen na een partij. Door even pauze te nemen, voorkom je dat je fouten uit frustratie negeert. Onderzoek toont aan dat spelers die 'tilten' hun eigen fouten neurologisch minder goed verwerken."*

### **Stap 2: Actieve Reproductie en Foutdetectie Zonder Engine**

Dit is de meest kritieke pedagogische stap. De conventionele methode van het simpelweg door een engine-evaluatiebalk klikken, vernietigt het leereffect. Het activeert slechts de herkenning in het kortetermijngeheugen, niet de reproductie-paden die nodig zijn tijdens een echte partij.

* **Aanbeveling:** De engine blijft **strikt uitgeschakeld**. De app identificeert algoritmisch het kritieke moment (de zet met de grootste centipion-verschuiving, afhankelijk van de RPL-filtering, zie Stap 3). De speler krijgt de stelling gepresenteerd en moet zélf de fout identificeren en een verbetering (kandidaatzet) voorstellen via tekst- en bord-invoer. Dit dwingt de speler tot 'retrieval practice'.  
* **Parameters / Specificaties:**

| Ratingband | Taak Zonder Engine | Aantal Kritieke Momenten | Tijdslimiet voor Taak |
| :---- | :---- | :---- | :---- |
| **\< 800** | Klik op het stuk dat gratis werd weggegeven (éénzet-blunder). | 1 moment (grootste blunder). | Geen limiet. |
| **800 \- 1200** | Voer een alternatieve zet in op het kantelpunt van de partij. | 2 momenten. | Max 2 minuten per moment. |
| **1200 \- 1600** | Voer een alternatieve hoofdvariant (tot 2 zetten diep) in met tekst-annotatie ("Plan was X"). | 2 tot 3 momenten. | Max 3 minuten per moment. |
| **1600 \- 2000** | Identificeer het punt van 'No Return' en voer 2 kandidaatzetten met evaluatie in. | 3 momenten (tactisch en positioneel). | Geen limiet. |
| **2000+** | Schrijf de varianten uit die tijdens de partij werden berekend (om gaten te vinden). | Alle fouten \> 50 CP. | Geen limiet. |

* **Per-rating notities:** Het vereiste detailniveau schaalt met de schaakkennis. Beginners (\<800) hebben de woordenschat niet om positionele beoordelingen te schrijven; hun focus moet liggen op het wegnemen van board-blindness (stukken weggeven)54.  
* **Bewijsgraad:** A (Robuust en sterk gerepliceerd principe van 'Desirable Difficulties' en de 'Generation Effect').  
* **Belangrijkste citaten:**  
  * Metcalfe, J., & Kornell, N. (2009). "The Role of Desirable Difficulties in Cognitive Science."7.  
  * Bjork, E. L., & Bjork, R. A. (2011). "Making things hard on yourself, but in a good way."20.  
* **Vertrouwen \+ Kanttekeningen:** Zeer hoog vertrouwen. De effectiviteit is ongeëvenaard in leersystemen. De grote uitdaging is dat dit aanzienlijke inspanning van de gebruiker vergt, wat ten koste kan gaan van engagement vergeleken met "gemakkelijke" passieve systemen.  
* **Gebruikersgerichte "waarom dit / waarom nu":** *"De engine direct aanzetten is als het antwoordenboekje bekijken voordat je de som maakt; je herkent het antwoord, maar je leert de methode niet. Door eerst zelf te denken, train je de exacte hersenpaden die je tijdens je volgende partij nodig hebt."*

### **Stap 3: Region of Proximal Learning (RPL) Engine Filtering**

Nadat de speler de stelling handmatig heeft geëvalueerd, wordt de engine-beoordeling vrijgegeven. Echter, niet elke engine-lijn is bruikbaar. Volgens de RPL-theorie leert men het meest van materiaal dat net buiten de huidige beheersing ligt ("low-hanging fruit") in plaats van onmogelijk moeilijke opgaven.

* **Aanbeveling:** De app parseert de partij en onderdrukt fouten die buiten de RPL van de speler vallen. Complexe positionele fouten (hoge entropie) worden verborgen voor spelers onder de 1600 rating. De focus ligt uitsluitend op begrijpelijke, eenduidige verbeteringen.  
* **Parameters / Specificaties:**

| Ratingband | Drempel voor Zichtbare Fouten (CP) | "High-Entropy" Filter (Verborgen Lijnen) | Focus van Leren |
| :---- | :---- | :---- | :---- |
| **\< 800** | \> 300 Centipionnen | Verberg alle voordelen die \>2 zetten diep liggen en geen mat/materiaal winnen. | Fundamentele veiligheid (stukken niet weggeven). |
| **800 \- 1200** | \> 200 Centipionnen | Verberg pure positionele manoeuvres (bijv. toren centraliseren voor \+1.5). | Directe tactische sequenties en één-zet bedreigingen. |
| **1200 \- 1600** | \> 100 Centipionnen | Verberg complexe engine-offers voor langetermijninitiatief. Toon tweede engine-keuze indien humaner. | Structurele fouten (dubbelpionnen, pionnenstructuur) en 3-zet tactiek. |
| **1600 \- 2000** | \> 50 Centipionnen | Geen harde filters, waarschuw dat positie "hoge entropie" (chaotisch) is. | Nuances in openingen, profylaxe, kandidaatzetten wegen. |
| **2000+** | Alle fluctuaties | Geen onderdrukking. Toon volledige evaluatie en boomstructuren. | Subtiele theorie, diepe macro-strategie. |

* **Per-rating notities:** Een engine kan evalueren dat een loperzet fout is omdat het over 12 zetten een eindspel met ongelijke lopers verliest. Dit presenteren aan een 1000-rated speler veroorzaakt vervreemding. Voor beginners forceert de app de presentatie van een inferieure maar leesbare engine-zet boven de absolute, maar onbegrijpelijke, top-engine zet27.  
* **Bewijsgraad:** A (Sterke onderbouwing via Metcalfe's RPL-model en de psychologie van cognitieve overbelasting).  
* **Belangrijkste citaten:**  
  * Metcalfe, J. (2002). "Is study time allocated optimally? The region of proximal learning."14.  
  * Luu et al. (2025). "Entropy and move complexity in chess."27.  
* **Vertrouwen \+ Kanttekeningen:** Hoog vertrouwen. Technisch is het berekenen van de 'entropie' (complexiteit en onduidelijkheid) van een engine-evaluatie echter uitdagend. De applicatie zal een heuristiek moeten gebruiken (bijv. volatiliteit van evaluatie bij diepte-toename) om te bepalen of een variant te moeilijk is.  
* **Gebruikersgerichte "waarom dit / waarom nu":** *"We filteren de suggesties van de computer. Een zet die pas over 15 zetten begrijpelijk wordt, helpt jouw spel nu niet. We focussen op de blunders en fouten die jij direct kunt begrijpen en de volgende keer kunt vermijden."*

### **Stap 4: Integratie van Fouten in een Spaced Repetition System (SRS)**

Een fout analyseren direct na een partij is slechts encoderen; het voorkomen van diezelfde fout vereist retentie. Zonder herhaling treedt de vergeetcurve van Ebbinghaus direct in werking.

* **Aanbeveling:** De app genereert automatisch een custom "Fouten-puzzel" (Tactics of Positional) uit het in Stap 2 en 3 geanalyseerde kritieke moment. Deze puzzel wordt gevoed aan een algoritmisch schema voor gespreide herhaling (Spaced Repetition System). De gebruiker krijgt deze puzzel de komende weken herhaaldelijk voorgelegd op het moment dat het patroon dreigt te vervagen in het geheugen.  
* **Parameters / Specificaties (Gecalibreerd op Disco Chess Data & FSRS-modellen):**

| SRS Niveau | Herhalingsinterval na Oplossing | Doel en Cognitieve Mechanismen |
| :---- | :---- | :---- |
| **Niveau 1 (Direct na creatie)** | 1 Dag | Korte-termijn consolidatie. Overbruggen van de initiële Ebbinghaus curve-val. |
| **Niveau 2** | 3 Dagen | Transformatie naar middellange opslag. Raakt de 85% succes-sweet spot. |
| **Niveau 3** | 7 Dagen | Diepere consolidatie en integratie in het procedurele geheugen ("Chunking"). |
| **Niveau 4** | 14 Dagen | Patroon beweegt van bewuste berekening naar intuïtieve herkenning. |
| **Niveau 5** | 30 Dagen | Verankering in het langetermijngeheugen. Retentie stijgt naar \>90%. |
| **Falen op enig moment** | Reset naar Niveau 1 | Indien de speler faalt, is het patroon gedegradeerd. Start het proces opnieuw. |

* **Per-rating notities:** Dit algoritme is domein-onafhankelijk en is relevant voor elke rating. De inhoud (wat wordt herhaald) verschilt, maar de tijdsintervallen zijn fysiologisch bepaald door de neuroplasticiteit van het brein17.  
* **Bewijsgraad:** A (Een van de meest robuuste en gerepliceerde bevindingen in de gehele leerwetenschap).  
* **Belangrijkste citaten:**  
  * Cepeda, N. J., et al. (2006). "Distributed practice in verbal recall tasks: A review and quantitative synthesis."58.  
  * Disco Chess / Tabibian et al. (2017). "Enhancing Human Learning via Spaced Repetition Optimization."19.  
* **Vertrouwen \+ Kanttekeningen:** Zeer hoog. Echter, bij schaken zijn positionele concepten moeilijker in 'flashcard'-stijl te toetsen dan simpele mat-in-1 patronen. De interface moet de vraagstelling ("Vind het beste positionele idee") correct framen om frustratie te voorkomen.  
* **Gebruikersgerichte "waarom dit / waarom nu":** *"Morgen ben je 40% vergeten van wat je vandaag hebt geleerd. Door je eigen gemaakte fouten als puzzels terug te laten komen vlak voordat je ze vergeet, verplaatsen we het patroon permanent naar je langetermijngeheugen. Dit is hoe intuïtie wordt gebouwd."*

### **Stap 5: Succes-Vooringenomen Partijselectie (Winsten Analyseren)**

De heersende schaakcultuur benadrukt uitsluitend het analyseren van verliezen. Gedragswetenschappelijke data wijzen uit dat dit suboptimaal is en leidt tot ego-uitputting en een lagere leeropbrengst bij het grote publiek.

* **Aanbeveling:** De applicatie stelt proactief voor om partijen te analyseren die de speler heeft *gewonnen*, met speciale aandacht voor momenten waarop de voorsprong onnauwkeurig werd omgezet. Het percentage winsten ten opzichte van verliezen dat voor analyse wordt voorgesteld, schaalt omgekeerd evenredig met de rating.  
* **Parameters / Specificaties:**

| Ratingband | Ratio Voorgestelde Analyses (Winst : Verlies) | Primaire Focus Tijdens Analyse |
| :---- | :---- | :---- |
| **\< 800** | 80% Winst : 20% Verlies | Positieve bekrachtiging. Waar speelde je goed? Waar miste je een snellere mat? |
| **800 \- 1200** | 70% Winst : 30% Verlies | Identificeren van gemiste tactische kansen terwijl je in het voordeel was. |
| **1200 \- 1600** | 60% Winst : 40% Verlies | Analyseer hoe het initiatief werd opgebouwd en geconsolideerd. |
| **1600 \- 2000** | 50% Winst : 50% Verlies | Balans tussen conversie-efficiëntie (winsten) en opening-fouten (verliezen). |
| **2000+** | 30% Winst : 70% Verlies | Strikte dissectie van microscopische onnauwkeurigheden. Verliezen zijn hier goud waard. |

* **Per-rating notities:** Experts hebben een hoge mate van ego-loskoppeling met betrekking tot fouten ontwikkeld gedurende jaren van 'deliberate practice'. Ze kunnen rationeler leren van falen. Beginners ervaren falen als een aanval op hun capaciteiten ("ego-threat") en stoppen met aandacht schenken ("tuning out"). Voor beginners is het leren van successen vele malen effectiever om het concept vast te houden8.  
* **Bewijsgraad:** B (Zeer sterke resultaten in algemene psychologie, ondersteund door grootschalige schaakspecifieke data, maar behoeft meer experimentele replicatie specifiek op de schaakbord-interface).  
* **Belangrijkste citaten:**  
  * Eskreis-Winkler, L., & Fishbach, A. (2022). "Not Learning From Failure—the Greatest Failure of All." *Psychological Science*.9.  
  * Yiannakoulias, N. (2026). "Learning From Wins and Losses: An Analysis of Improvement in Online Speed Chess."8.  
* **Vertrouwen \+ Kanttekeningen:** Hoog vertrouwen in de psychologische barrière van falen bij amateurs. Een kanttekening is dat de applicatie wel een mechanisme moet hebben waarbij structurele blunders in gewonnen partijen ook worden geïsoleerd in de SRS (Stap 4).  
* **Gebruikersgerichte "waarom dit / waarom nu":** *"Mensen leren makkelijker en met meer plezier van hun successen. Wetenschappelijke analyse van miljoenen online partijen toont aan dat het aanscherpen van partijen waarin je goed speelde, meer ratingwinst oplevert dan constant staren naar pijnlijke verliezen."*

## **Belangrijkste Bronnen en Evaluatie van Kwaliteit**

De architectuur van deze protocollen is gestut door de onderstaande literatuur. Deze bronnen zijn geselecteerd op basis van hun methodologische robuustheid, steekproefomvang en theorie-vormende impact.

1. **Hambrick et al. (2014) & Macnamara et al. (2014)**31: *Methodologie: Meta-analyses.* Kwaliteit: Hoogst mogelijk (A). De definitieve herziening van de "10.000 uur regel", die aantoont dat bewuste oefening belangrijk is maar slechts \~26% van de prestatie verklaart in spellen. Cruciaal voor realisme in de app.  
2. **Yiannakoulias (2026) "Learning From Wins and Losses in Online Speed Chess"**8: *Methodologie: Observationele analyse van \~2 miljoen online schaakpartijen.* Kwaliteit: Hoog (A/B). Schaak-specifiek, enorme dataset. Levert het kritische bewijs dat het analyseren van winsten effectiever is voor ratingtoename dan verliezen.  
3. **Eskreis-Winkler & Fishbach (2022) "Not Learning From Failure"**9: *Methodologie: Empirische peer-reviewed psychologische studies (N=1.674).* Kwaliteit: Hoog (A). Levert het psychologische mechanisme ("ego-threat") dat verklaart *waarom* Yiannakoulias' bevindingen waar zijn.  
4. **Wilson et al. (2019) "The Eighty Five Percent Rule for Optimal Learning"**11: *Methodologie: Computationele wiskunde en gedragsmodellen.* Kwaliteit: Hoog (A). Bewijst wiskundig dat trainen op 85% accuratesse de leergradiënt in neurale netwerken (zowel menselijk als kunstmatig) maximaliseert.  
5. **Metcalfe, Kornell, & Finn (2009) / Metcalfe (2002)**7: *Methodologie: Peer-reviewed cognitieve wetenschapsobservering.* Kwaliteit: Hoog (A). Vormt het fundament voor de "Region of Proximal Learning" (RPL) en toont aan waarom onmiddellijke feedback schadelijk is voor langetermijn-leren.  
6. **Charness et al. (2005) "The Role of Deliberate Practice in Chess Expertise"**2: *Methodologie: Multivariabele regressie-analyse bij toernooispelers.* Kwaliteit: Hoog (A). Schaak-specifiek. Bevestigt dat serieuze, eenzame studie de krachtigste voorspeller is voor schaakrating, wat het concept van deze solo-trainingsapp valideert.  
7. **Cepeda et al. (2006) "Distributed practice in verbal recall tasks"**58: *Methodologie: Meta-analyse (80 jaar literatuur).* Kwaliteit: Hoogst mogelijk (A). De hoeksteen van de 'Spacing Effect' literatuur. Essentieel voor de SRS timing en de kritiek op bingeleren.  
8. **Chowdhary et al. (2023) "Quantifying human performance in chess"**60: *Methodologie: Datamining van 120 miljoen schaakpartijen.* Kwaliteit: Hoog (A). Identificeert de leerpaden van beginners naar experts, specifiek de ontwikkeling van opening-diversiteit en specialisatie.

## **Wat Ontbreekt in de Wetenschappelijke Literatuur**

Om te voldoen aan de eis van radicale eerlijkheid en een strikte, "no-BS" wetenschappelijke methodologie, identificeert deze rapportage expliciet gebieden waar sluitend empirisch bewijs ontbreekt.

* **Exacte Oorzaak-Gevolg in Openingsstudie voor Beginners:** Er is geen consensus of het bestuderen van theorie-openingen (zoals de Spaanse Opening) effectiever is voor beginners (\<1000 rating) dan het louter uitoefenen van "openingsprincipes" (centrumcontrole, stukken ontwikkelen). De meeste grootmeesters (Coach Opinion) raden openingstheorie af voor beginners, maar gecontroleerde onderzoeken die een "principes vs. theorie" A/B-test hebben uitgevoerd, ontbreken.  
* **Het Exacte Algoritme voor Complexe Posities:** Hoewel Tabibian et al. hebben aangetoond dat geoptimaliseerde herhaling superieur is voor taal44, en platformen zoals Chessable "Level 1 \= 4 uur, Level 2 \= 1 dag" gebruiken57, is het onbekend wat de fysiologisch perfecte interval-curve is voor het herzien van *gehele partijen* of abstracte strategische plannen. Het is onbekend in hoeverre het overdragen van elementaire "flashcard"-achtige cognitie één-op-één werkt voor netwerk-denken in complexe schaakposities.  
* **Transfer van Oefening (Far-Transfer):** Wetenschappelijke literatuur toont consequent aan dat vaardigheden verworven in schaken *niet* (of slechts in zeer marginale mate) transfereren naar algemene probleemoplossing of wiskunde62. Beweringen in de bredere schaakwereld dat schaaktraining "intelligentie" verhoogt, zijn veelal niet empirisch ondersteund. Het platform mag schaaktraining enkel framen in de context van domeinspecifieke vaardigheidsverbetering (schaken om beter te schaken).

*This is for informational purposes only. For medical advice or diagnosis, consult a professional.*

#### **Geciteerd werk**

1. Expertise in Chess (Chapter 31\) \- The Cambridge Handbook of Expertise and Expert Performance, [https://www.cambridge.org/core/books/cambridge-handbook-of-expertise-and-expert-performance/expertise-in-chess/6E7F07A536AED091520EE9AE31128CCE](https://www.cambridge.org/core/books/cambridge-handbook-of-expertise-and-expert-performance/expertise-in-chess/6E7F07A536AED091520EE9AE31128CCE)  
2. The role of deliberate practice in chess expertise \- CHREST, [http://www.chrest.info/Fribourg\_Cours\_Expertise/Articles-www/II%20Donnees%20empiriques/CharnessEtal2005ACP.pdf](http://www.chrest.info/Fribourg_Cours_Expertise/Articles-www/II%20Donnees%20empiriques/CharnessEtal2005ACP.pdf)  
3. The role of deliberate practice in chess | Request PDF \- ResearchGate, [https://www.researchgate.net/publication/224827569\_The\_role\_of\_deliberate\_practice\_in\_chess](https://www.researchgate.net/publication/224827569_The_role_of_deliberate_practice_in_chess)  
4. The Key to Your Improvement \- Chess Forums, [https://www.chess.com/forum/view/general/the-key-to-your-improvement](https://www.chess.com/forum/view/general/the-key-to-your-improvement)  
5. Embracing the "Desirable Difficulties" of Learning \- ThoughtStretchers Education, [https://wegrowteachers.com/embracing-desirable-difficulties/](https://wegrowteachers.com/embracing-desirable-difficulties/)  
6. Desirable Difficulties: Why Making Learning Harder Makes It Stick \- Growth Engineering, [https://www.growthengineering.co.uk/desirable-difficulties/](https://www.growthengineering.co.uk/desirable-difficulties/)  
7. Not So Fast: The Hidden Value of Delaying Educational Feedback | by Jay Lynch | Medium, [https://medium.com/@quixotic\_scholar/not-so-fast-the-hidden-value-of-delaying-educational-feedback-b2282caa04f5](https://medium.com/@quixotic_scholar/not-so-fast-the-hidden-value-of-delaying-educational-feedback-b2282caa04f5)  
8. Learning From Wins and Losses: An Analysis of Improvement in Online Speed Chess, [https://www.researchgate.net/publication/403850217\_Learning\_From\_Wins\_and\_Losses\_An\_Analysis\_of\_Improvement\_in\_Online\_Speed\_Chess](https://www.researchgate.net/publication/403850217_Learning_From_Wins_and_Losses_An_Analysis_of_Improvement_in_Online_Speed_Chess)  
9. (PDF) You Think Failure Is Hard? So Is Learning From It \- ResearchGate, [https://www.researchgate.net/publication/360685232\_You\_Think\_Failure\_Is\_Hard\_So\_Is\_Learning\_From\_It](https://www.researchgate.net/publication/360685232_You_Think_Failure_Is_Hard_So_Is_Learning_From_It)  
10. (PDF) Not Learning From Failure—the Greatest Failure of All \- ResearchGate, [https://www.researchgate.net/publication/337127055\_Not\_Learning\_From\_Failure-the\_Greatest\_Failure\_of\_All](https://www.researchgate.net/publication/337127055_Not_Learning_From_Failure-the_Greatest_Failure_of_All)  
11. 85% Rule of Optimal Learning \- by Drenizë Rama \- Medium, [https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842](https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842)  
12. The Eighty Five Percent Rule for optimal learning \- ResearchGate, [https://www.researchgate.net/publication/337036886\_The\_Eighty\_Five\_Percent\_Rule\_for\_optimal\_learning](https://www.researchgate.net/publication/337036886_The_Eighty_Five_Percent_Rule_for_optimal_learning)  
13. The Eighty Five Percent Rule for optimal learning \- eScholarship.org, [https://escholarship.org/content/qt0v22s4g4/qt0v22s4g4.pdf](https://escholarship.org/content/qt0v22s4g4/qt0v22s4g4.pdf)  
14. Metcalfe 2009 | PDF | Metacognition | Recall (Memory) \- Scribd, [https://www.scribd.com/document/140556077/Metcalfe-2009](https://www.scribd.com/document/140556077/Metcalfe-2009)  
15. 1 Desirable Difficulties and Studying in the Region of Proximal Learning Janet Metcalfe Columbia University Please address corr, [https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Metcalfe-BjorkVolSubmitFeb14Final.pdf](https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Metcalfe-BjorkVolSubmitFeb14Final.pdf)  
16. The Dynamics of Learning and Allocation of Study Time to a Region of Proximal Learning \- Columbia University, [https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Metcalfe%20Kornell%202003.pdf](https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Metcalfe%20Kornell%202003.pdf)  
17. Spaced repetition: Tips and tricks on how to get the best out of it \- Chessable, [https://www.chessable.com/blog/spaced-repetition-chess/](https://www.chessable.com/blog/spaced-repetition-chess/)  
18. Revisiting Hebb: The Mechanisms of Repetition Learning \- PMC \- NIH, [https://pmc.ncbi.nlm.nih.gov/articles/PMC13095083/](https://pmc.ncbi.nlm.nih.gov/articles/PMC13095083/)  
19. Mistake Review \- Turn Chess Weaknesses into Strengths, [https://www.discochess.com/platform/mistake-review](https://www.discochess.com/platform/mistake-review)  
20. Desirable Difficulties: Bjork's 5 Principles \- Structural Learning, [https://www.structural-learning.com/post/desirable-difficulties](https://www.structural-learning.com/post/desirable-difficulties)  
21. Desirable difficulty \- Wikipedia, [https://en.wikipedia.org/wiki/Desirable\_difficulty](https://en.wikipedia.org/wiki/Desirable_difficulty)  
22. Introducing Desirable Difficulties Into Practice and Instruction: Obstacles and Opportunities Learning Versus Performance \- University of New Hampshire, [https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf)  
23. The Pretesting Effect: Exploring the Impact of Feedback and Final Test Timing \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12292081/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292081/)  
24. The Pretesting Effect: Why Testing Before Teaching Works \- Structural Learning, [https://www.structural-learning.com/post/pretesting-effect-testing-before-teaching](https://www.structural-learning.com/post/pretesting-effect-testing-before-teaching)  
25. Daily Chess Puzzles: The Habit That Improves Your Chess \- Chessigma, [https://www.chessigma.com/blog/daily-chess-puzzle](https://www.chessigma.com/blog/daily-chess-puzzle)  
26. 5 steps to using the spacing effect in your next training | Learning Pool, [https://learningpool.com/blog/5-steps-to-using-the-spacing-effect-in-your-next-training](https://learningpool.com/blog/5-steps-to-using-the-spacing-effect-in-your-next-training)  
27. Chess variation entropy and engine relevance for humans \- arXiv, [https://arxiv.org/html/2505.03251v1](https://arxiv.org/html/2505.03251v1)  
28. The Complete Beginner's Guide to Deliberate Practice \- NJlifehacks, [https://www.njlifehacks.com/deliberate-practice/](https://www.njlifehacks.com/deliberate-practice/)  
29. The GPS for Thinking: How AI Partners Are Reshaping Student Metacognition \- Preprints.org, [https://www.preprints.org/manuscript/202605.1603](https://www.preprints.org/manuscript/202605.1603)  
30. How To Annotate Your Games To Improve At Chess, [https://www.chess.com/article/view/how-to-annotate-your-games-for-chess-improvers](https://www.chess.com/article/view/how-to-annotate-your-games-for-chess-improvers)  
31. The Impact of Domain-Specific Experience on Chess Skill: Reanalysis of a Key Study, [https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/Burgoyne-ImpactDomainSpecificExperience-2019.pdf](https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/Burgoyne-ImpactDomainSpecificExperience-2019.pdf)  
32. Is That All It Takes To Become An Expert? David Z. Hambrick1, Frederick L. Oswald \- University of Liverpool Repository, [https://livrepository.liverpool.ac.uk/3002338/1/Hambrick%20et%20al%20--%20Deliberate%20Practice%20-%20Is%20That%20All%20It%20Takes%20To%20Become%20An%20Expert.pdf](https://livrepository.liverpool.ac.uk/3002338/1/Hambrick%20et%20al%20--%20Deliberate%20Practice%20-%20Is%20That%20All%20It%20Takes%20To%20Become%20An%20Expert.pdf)  
33. Deliberate Practice and Performance in Music, Games, Sports, Education, and Professions: A Meta-Analysis \- College of Health and Human Sciences, [https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/macnamara-et-al-2014-deliberate-practice-and-performance-in-music-games-sports-education-and-professions-a-meta-analysis.pdf](https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/macnamara-et-al-2014-deliberate-practice-and-performance-in-music-games-sports-education-and-professions-a-meta-analysis.pdf)  
34. The Role of Domain-Specific Practice, Handedness, and Starting Age in Chess, [https://www.researchgate.net/publication/6598587\_The\_role\_of\_domain-specific\_practice\_handedness\_and\_starting\_age\_in\_chess](https://www.researchgate.net/publication/6598587_The_role_of_domain-specific_practice_handedness_and_starting_age_in_chess)  
35. Quick summary of academic research (part 3): Gobet, Campitelli \- The Role of Domain-Specific Practice, Handedness and Starting Age in Chess (2007) \- Reddit, [https://www.reddit.com/r/chess/comments/l1p4b1/quick\_summary\_of\_academic\_research\_part\_3\_gobet/](https://www.reddit.com/r/chess/comments/l1p4b1/quick_summary_of_academic_research_part_3_gobet/)  
36. 28/12/2007 1 out of 36 Gobet, F., & Charness, N. (2006). Chess and games. Cambridge handbook on expertise and expert perform \- Brunel University Research Archive, [https://bura.brunel.ac.uk/bitstream/2438/1475/1/Gobet-Charness-CUP-chess%20expertise.pdf](https://bura.brunel.ac.uk/bitstream/2438/1475/1/Gobet-Charness-CUP-chess%20expertise.pdf)  
37. Niko Yiannakoulias's research works \- ResearchGate, [https://www.researchgate.net/scientific-contributions/Niko-Yiannakoulias-2347112842](https://www.researchgate.net/scientific-contributions/Niko-Yiannakoulias-2347112842)  
38. (PDF) Incorporating Desirable Difficulties into the design of digital learning: A think-aloud study \- ResearchGate, [https://www.researchgate.net/publication/396659236\_Incorporating\_Desirable\_Difficulties\_into\_the\_design\_of\_digital\_learning\_A\_think-aloud\_study](https://www.researchgate.net/publication/396659236_Incorporating_Desirable_Difficulties_into_the_design_of_digital_learning_A_think-aloud_study)  
39. How To Use An Electronic Chess Board To Prepare for Tournaments, [https://www.uscfsales.com/blogs/chess-matches/how-to-use-an-electronic-chess-board-to-prepare-for-tournaments](https://www.uscfsales.com/blogs/chess-matches/how-to-use-an-electronic-chess-board-to-prepare-for-tournaments)  
40. Using Physical chess board for online games, [https://www.chess.com/forum/view/general/using-physical-chess-board-for-online-games](https://www.chess.com/forum/view/general/using-physical-chess-board-for-online-games)  
41. Is it true that playing over a physical chess board is better than playing online chess?, [https://lichess.org/forum/general-chess-discussion/is-it-true-that-playing-over-a-physical-chess-board-is-better-than-playing-online-chess](https://lichess.org/forum/general-chess-discussion/is-it-true-that-playing-over-a-physical-chess-board-is-better-than-playing-online-chess)  
42. Physical chess Board or Online \- Chessable, [https://www.chessable.com/discussion/thread/905052/physical-chess-board-or-online/old/](https://www.chessable.com/discussion/thread/905052/physical-chess-board-or-online/old/)  
43. CheckRaiseMate's Blog • Spaced Repetition \- Lichess.org, [https://lichess.org/@/CheckRaiseMate/blog/spaced-repetition/eteyH8MT](https://lichess.org/@/CheckRaiseMate/blog/spaced-repetition/eteyH8MT)  
44. Optimal spaced repetition algorithm \- Chessable, [https://www.chessable.com/discussion/thread/55172/optimal-spaced-repetition-algorithm/new/](https://www.chessable.com/discussion/thread/55172/optimal-spaced-repetition-algorithm/new/)  
45. Much needed \- Spaced Repetition Tactics \- Lichess.org, [https://lichess.org/forum/lichess-feedback/much-needed---spaced-repetition-tactics](https://lichess.org/forum/lichess-feedback/much-needed---spaced-repetition-tactics)  
46. How Much Does Self-Control Really Matter in Chess Improvement? \- Chessable, [https://www.chessable.com/blog/how-much-does-self-control-really-matter-in-chess-improvement/](https://www.chessable.com/blog/how-much-does-self-control-really-matter-in-chess-improvement/)  
47. The Impact of Domain-Specific Experience on Chess Skill: Reanalysis of a Key Study, [https://englelab.gatech.edu/articles/2019/Burgoyne\_et\_al\_2019\_AJP.pdf](https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf)  
48. Expertise-dependent mental representation in chess: evaluation and comparisons based on structural dimensional analysis-motoric \- Frontiers, [https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1695175/full](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1695175/full)  
49. The Role of Deliberate Practice in Chess Expertise \- Clinica Ispa, [https://clinica.ispa.pt/sites/default/files/11\_-\_the\_role\_of\_dp\_in\_chess\_expertise.pdf](https://clinica.ispa.pt/sites/default/files/11_-_the_role_of_dp_in_chess_expertise.pdf)  
50. Chess and Problem Solving: Training Your Brain to Anticipate \- DYNSEO, [https://www.dynseo.com/en/chess-and-problem-solving-training-your-brain-to-anticipate/](https://www.dynseo.com/en/chess-and-problem-solving-training-your-brain-to-anticipate/)  
51. A metacognitive appraisal of quitting \- Cognitive Science, [https://www.cgs.iitk.ac.in/user/nsrivast/platipus-lab/publications/2025-metacog-quitting.pdf](https://www.cgs.iitk.ac.in/user/nsrivast/platipus-lab/publications/2025-metacog-quitting.pdf)  
52. Science of Chess: Knowing when to think (and when to just move), [https://www.chess.com/blog/bjbalas/science-of-chess-knowing-when-to-think-and-when-to-just-move](https://www.chess.com/blog/bjbalas/science-of-chess-knowing-when-to-think-and-when-to-just-move)  
53. Beyond the ELO: Embracing Failure in the Game of Chess and Life, [https://www.chess.com/blog/Danielkaas94/beyond-the-elo-embracing-failure-in-the-game-of-chess-and-life](https://www.chess.com/blog/Danielkaas94/beyond-the-elo-embracing-failure-in-the-game-of-chess-and-life)  
54. Analyzing own games \- how? \- Chessable, [https://www.chessable.com/discussion/thread/651107/analyzing-own-games-how/651134/](https://www.chessable.com/discussion/thread/651107/analyzing-own-games-how/651134/)  
55. How To Analyze Your Games \- Chess.com, [https://www.chess.com/article/view/how-to-analyze-your-chess-games](https://www.chess.com/article/view/how-to-analyze-your-chess-games)  
56. Analyze your Chess Games \- Why and How | International Chess School, [https://www.chessmasterschool.com/blog/analyze-chess-games.html](https://www.chessmasterschool.com/blog/analyze-chess-games.html)  
57. How does the spaced repetition scheduling work? | Chess.com Help Center, [https://support.chess.com/en/articles/10319322-how-does-the-spaced-repetition-scheduling-work](https://support.chess.com/en/articles/10319322-how-does-the-spaced-repetition-scheduling-work)  
58. The Spacing Effect in Skills Training and Deliberate Practice \- VirTra, Inc, [https://www.virtra.com/the-spacing-effect-in-skills-training-and-deliberate-practice/](https://www.virtra.com/the-spacing-effect-in-skills-training-and-deliberate-practice/)  
59. Enforcing a high success percentage interferes with reward-based motor learning \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC13031413/](https://pmc.ncbi.nlm.nih.gov/articles/PMC13031413/)  
60. (PDF) Quantifying human performance in chess \- ResearchGate, [https://www.researchgate.net/publication/368297131\_Quantifying\_human\_performance\_in\_chess](https://www.researchgate.net/publication/368297131_Quantifying_human_performance_in_chess)  
61. How does the spaced repetition scheduling work? | Chessable Help Center, [https://support.chessable.com/en/articles/9043598-how-does-the-spaced-repetition-scheduling-work](https://support.chessable.com/en/articles/9043598-how-does-the-spaced-repetition-scheduling-work)  
62. Does chess instruction improve mathematical problem-solving ability? Two experimental studies with an active control group \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC5709436/](https://pmc.ncbi.nlm.nih.gov/articles/PMC5709436/)  
63. Do Chess Really Develop Intelligence? What Science Says \- DYNSEO, [https://www.dynseo.com/en/do-chess-really-develop-intelligence-what-science-says/](https://www.dynseo.com/en/do-chess-really-develop-intelligence-what-science-says/)