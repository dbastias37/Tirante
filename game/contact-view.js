// A magnified projection of the same physical vertices, never a canned crossing.
export function drawContact(canvas,duel){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);
  const hit=duel.lastHit,cut=[duel.player.rope,duel.rival.rope].find(r=>r.breakAge<2);
  if(!hit||(!duel.contact&&!cut)){c.fillStyle='#839081';c.font='18px sans-serif';c.textAlign='center';c.fillText('El detalle aparece al tocar los hilos',w/2,h/2+6);return;}
  const a=duel.player.rope,b=duel.rival.rope,origin=cut?.breakPoint||duel.contactPoint;
  const u=a.points[Math.min(hit.i+1,a.points.length-1)].clone().sub(a.points[hit.i]).normalize();
  const t=b.points[Math.min(hit.j+1,b.points.length-1)].clone().sub(b.points[hit.j]).normalize();
  const n=u.clone().cross(t);if(n.lengthSq()<.0001)n.set(0,0,1);n.normalize();const v=n.cross(u).normalize();
  const project=q=>{const d=q.clone().sub(origin);return [w/2+d.dot(u)*210,h/2-d.dot(v)*210];};
  c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
  for(const [r,color] of [[b,'#397f80'],[a,'#bd7952']]){
    for(let i=0;i<r.points.length-1;i++){if(i===r.broken)continue;const p=project(r.points[i]),q=project(r.points[i+1]);c.beginPath();c.moveTo(...p);c.lineTo(...q);c.strokeStyle=color;c.lineWidth=6;c.stroke();c.setLineDash([2,9]);c.lineDashOffset=r.owner.lineLength*210;c.strokeStyle='#fff4da';c.lineWidth=2;c.stroke();c.setLineDash([]);}
    if(r.broken>=0)for(const index of [r.broken,r.broken+1]){const [x,y]=project(r.points[index]);c.fillStyle=color;c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}
  }
  if(!cut){const worn=Math.max(a.wearAt(hit.i,hit.s),b.wearAt(hit.j,hit.t));c.strokeStyle='#d3a35b';c.lineWidth=1.5;for(let k=0;k<Math.ceil(worn*12);k++){const angle=k*2.4;c.beginPath();c.moveTo(w/2,h/2);c.lineTo(w/2+Math.cos(angle)*(8+worn*12),h/2+Math.sin(angle)*(8+worn*12));c.stroke();}c.beginPath();c.arc(w/2,h/2,13,0,Math.PI*2);c.strokeStyle='#b18c4f70';c.stroke();}
  c.restore();
}
