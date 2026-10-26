import {distanceHTML} from './units.js';
// One set of instruments, moved into a sheet on phones and short viewports.
// Keeping the original nodes preserves their values, listeners and focus.
export class CompactFlightUI {
  constructor({open, close, release, currentModal}) {
    this.$ = id => document.getElementById(id);
    this.open = open;
    this.close = close;
    this.release = release;
    this.currentModal = currentModal;
    this.query = matchMedia('(max-width: 760px), (max-height: 560px) and (orientation: landscape)');
    this.panels = ['.flight-left', '.flight-right', '#duel-hud', '#trail-hud'].map(selector => {
      const node = document.querySelector(selector), home = document.createComment('instrument home');
      node.before(home);
      return {node, home};
    });
    this.$('details-button').addEventListener('click', () => open('flight-details-modal'));
    this.$('compact-round').addEventListener('click', () => open('flight-details-modal'));
    this.$('view-tools-button').addEventListener('click', () => this.setCameraTools(!this.cameraOpen));
    this.query.addEventListener('change', () => this.resize());
    // Also release held inputs when rotating between two compact layouts.
    window.addEventListener('orientationchange', () => { release(); this.setCameraTools(false); });
    this.resize();
  }

  resize() {
    this.release();
    this.setCameraTools(false);
    const compact = this.query.matches;
    document.body.classList.toggle('compact-ui', compact);
    if (!compact && this.currentModal() === 'flight-details-modal') this.close();
    for (const {node, home} of this.panels) {
      if (compact) this.$('flight-details-grid').append(node);
      else home.after(node);
    }
  }

  setFlight(flight) {
    document.body.classList.toggle('in-flight', flight);
    this.setCameraTools(false);
  }

  setCameraTools(open) {
    this.cameraOpen = open && this.query.matches;
    document.body.classList.toggle('camera-tools-open', this.cameraOpen);
    this.$('view-tools-button').setAttribute('aria-expanded', String(this.cameraOpen));
  }

  update({physics: p, duel, trail, online, audio, assists}) {
    this.$('pause-audio').textContent = `Sonido: ${audio?.enabled ? 'activado' : 'apagado'}`;
    this.$('pause-assists').textContent = `Ayudas visuales: ${assists ? 'sí' : 'no'}`;
    if (!this.query.matches) return;
    this.$('compact-line').innerHTML = distanceHTML(p.lineLength);
    this.$('compact-wind').textContent = Math.round(p.windKmh) + ' km/h';
    this.$('compact-energy').textContent = Math.round(p.energy) + '%';
    this.$('compact-energy-bar').style.width = p.energy + '%';
    this.$('compact-meters').classList.toggle('low-energy', p.energy < 20);
    this.$('compact-line-state').style.background = this.$('tension-fill').style.background;
    this.$('compact-line-state').title = 'Tensión: ' + this.$('tension-label').textContent;
    this.$('details-hint').textContent = this.$('status-title').textContent + ' ' + this.$('status-description').textContent;
    this.$('details-extra').textContent = `Vueltas: ${p.turns} · Energía: ${Math.round(p.energy)}% · ${this.$('energy-state').textContent}`;
    this.$('details-pause').textContent = online?.active ? 'El duelo online continúa.' : 'El vuelo se pausa al abrir estos datos.';
    const round = this.$('compact-round');
    round.classList.toggle('hidden', !duel.visible && !trail.visible);
    if (trail.visible) {
      this.$('compact-round-label').textContent = `Rastro · ${trail.index} / ${trail.points.length}`;
      this.$('compact-round-clock').textContent = this.$('trail-clock').textContent;
      this.$('compact-round-detail').textContent = trail.state === 'preparing' ? 'Prepárate' : this.$('trail-bonus').textContent;
      round.classList.toggle('urgent', trail.remaining < 15);
    } else if (duel.visible) {
      this.$('compact-round-label').textContent = duel.partyMode ? `${duel.spectating?'Espectador':duel.rules==='last-man'?'Último en pie':'Party'} · ${duel.contenders.length}` : 'Duelo online';
      this.$('compact-round-clock').textContent = this.$('duel-timer').textContent;
      this.$('compact-round-detail').textContent = p.eliminated&&p.lives>0?`Vuelves en ${Math.max(1,Math.ceil(p.respawnAt-duel.elapsed))} s · ${p.lives} vidas`:duel.spectating?`Siguiendo: ${duel.watched?.name||'todos'}`:`${p.lives??3} vidas · Hilo ${Math.ceil(duel.playerHealth)}%${duel.contact ? ` · Carga ${Math.round((p.rope.stressRatio||0)*100)}%` : ''}`;
      round.classList.toggle('urgent', duel.playerHealth < 25 || p.rope.stressRatio > .8);
    }
  }
}
