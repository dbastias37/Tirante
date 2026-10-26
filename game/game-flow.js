export const GAME_MODES=Object.freeze([
  {id:'free',name:'Vuelo libre',tag:'A TU RITMO',description:'Explora el cielo, prueba tus tirantes y aprende a leer el viento.'},
  {id:'party',name:'Party',tag:'1–3 RIVALES NPC',description:'Tres vidas por participante. Cruza hilos en altura; gana por vidas y estado del hilo.'},
  {id:'last-man',name:'Último en pie',tag:'SIN LÍMITE DE TIEMPO',description:'Elige 3, 5 o 10 vidas. La batalla continúa hasta que quede un participante con vidas.'},
  {id:'trail',name:'Rastro de luz',tag:'CONTRARRELOJ',description:'Ocho destellos, una ruta y 90 segundos. Cada captura te devuelve tiempo.'},
  {id:'online',name:'Duelo online',tag:'DOS PERSONAS',description:'Duelo de tres vidas. Prepara tu equipo y crea una sala o entra con una invitación.'}
]);
export class GameFlow{
  constructor(){this.state='title';this.choice='free';}
  get preparing(){return this.state==='prepare';}
  go(page){if(!['title','menu','modes','prepare','settings','hidden'].includes(page))throw new Error('Pantalla no válida');this.state=page;return this.state;}
  choose(id){if(!GAME_MODES.some(mode=>mode.id===id))throw new Error('Modo no válido');this.choice=id;this.state='prepare';}
  back(){return this.go({prepare:'modes',modes:'menu',settings:'menu',menu:'title'}[this.state]||'title');}
  hide(){this.state='hidden';}
}
