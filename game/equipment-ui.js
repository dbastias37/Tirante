import {THREADS,REELS,BEARINGS,equipmentStats} from './equipment.js';
import {EquipmentView} from './equipment-view.js';
const $=id=>document.getElementById(id),CATEGORIES=[{key:'lineType',kind:'thread',title:'Hilo',items:THREADS},{key:'reelType',kind:'reel',title:'Carrete',items:REELS},{key:'bearingType',kind:'bearing',title:'Rodamiento',items:BEARINGS}];
export class EquipmentUI{
  constructor(setup,change,webgl){this.setup=setup;this.change=change;this.category=0;this.view=new EquipmentView($('equipment-model'),webgl);
    $('equipment-prev').onclick=()=>this.cycle(-1);$('equipment-next').onclick=()=>this.cycle(1);$('equipment-up').onclick=()=>this.move(-1);$('equipment-down').onclick=()=>this.move(1);
    for(let i=0;i<3;i++)$('equipment-tab-'+i).onclick=()=>{this.category=i;this.paint();};
    $('equipment-spin').onclick=()=>{this.view.auto=!this.view.auto;$('equipment-spin').textContent=this.view.auto?'Pausar giro':'Girar 360°';$('equipment-spin').setAttribute('aria-pressed',this.view.auto);};
  }
  move(delta){this.category=(this.category+delta+3)%3;this.paint();}
  cycle(delta){const c=CATEGORIES[this.category],i=c.items.findIndex(x=>x.id===this.setup[c.key]);this.setup[c.key]=c.items[(i+delta+c.items.length)%c.items.length].id;this.change();this.paint();}
  key(e){const actions={ArrowLeft:()=>this.cycle(-1),ArrowRight:()=>this.cycle(1),ArrowUp:()=>this.move(-1),ArrowDown:()=>this.move(1)};if(actions[e.key]){e.preventDefault();actions[e.key]();return true;}return false;}
  paint(){const c=CATEGORIES[this.category],s=equipmentStats(this.setup),i=c.items.findIndex(x=>x.id===this.setup[c.key]),item=c.items[i];
    $('equipment-stage-label').textContent=`0${this.category+1} / ${c.title.toUpperCase()}`;$('equipment-item-title').textContent=item.name;$('equipment-item-note').textContent=item.note;$('equipment-count').textContent=`${i+1} / ${c.items.length}`;
    for(let j=0;j<3;j++){$('equipment-tab-'+j).setAttribute('aria-selected',j===this.category);$('equipment-choice-'+j).textContent=CATEGORIES[j].items.find(x=>x.id===this.setup[CATEGORIES[j].key]).name;}
    const stats=this.category===0?[['Grosor aprox.',`${item.diameter.toFixed(2).replace('.',',')} mm`],['Peso / 100 m',`${Math.round(item.mass*100)} g`],['Resistencia',`${Math.round(item.strength/90*100)} %`],['Aguante al roce',`${Math.round(item.wear*100)} %`]]:this.category===1?[['Diámetro',`${item.diameter.toFixed(1).replace('.',',')} cm`],['Peso',`${item.mass} g`],['Recogida',`${item.speed.toFixed(2)}×`],['Esfuerzo',`${Math.round(item.effort*100)} %`]]:[['Peso',`${item.mass} g`],['Fricción',`${item.friction} / 100`],['Velocidad',`${item.speed.toFixed(2)}×`],['Esfuerzo',`${Math.round(item.effort*100)} %`]];
    $('equipment-stats').replaceChildren(...stats.map(([label,value])=>{const cell=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;cell.append(term,detail);return cell;}));
    $('equipment-summary').textContent=`Conjunto equipado · velocidad ${s.speed.toFixed(2)}× · esfuerzo ${Math.round(s.effort*100)} %`;
    this.view.set(c.kind,this.setup);
  }
  frame(dt){this.view.frame(dt);}
}
