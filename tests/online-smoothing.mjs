import assert from 'node:assert/strict';
import {OnlineGame} from '../game/online.js';
import {Vector3} from '../game/vendor/three.module.js';
import {KitePhysics} from '../game/physics.js';
import {Commission} from '../game/commission.js';
import {createMatch,packMatch,snapshot} from '../server/online-match.js';
const room={code:'ABCDEFGH',round:1,settings:{capacity:150,profile:'breeze',wind:5.5},players:[{name:'A',lastSeen:0,seq:0,tugSeq:0},{name:'B',lastSeen:0,seq:0,tugSeq:0}]};
room.match=packMatch(createMatch(room));
for(const slot of [0,1]){
 const client=Object.create(OnlineGame.prototype),view=new Commission(new KitePhysics());client.interval=100;
 const make=(shift,round=1)=>{const s=snapshot(room,slot,0);s.round=round;for(const k of s.match.pilots){k.body.position.vector[1]+=shift;k.body.anchor.vector[1]+=shift;k.body.time=shift;k.body.bend=shift/10;for(const q of k.rope.points)q[1]+=shift;}return s;};
 client.latest=make(0);client.render(view.player,view,0);const initial=view.player.position.clone();
 client.latest=make(2);client.render(view.player,view,10);client.render(view.player,view,50);
 const middle=view.player.position.clone(),rope=view.player.rope.points.map(p=>p.clone()),time=view.player.time,bend=view.player.bend;
 assert.ok(middle.y>initial.y&&middle.y<initial.y+2);
 client.latest=make(4);client.render(view.player,view,50);
 assert.ok(view.player.position.distanceTo(middle)<1e-9,'An early packet cannot jump the rendered kite');
 assert.ok(view.player.rope.points.every((p,i)=>p.distanceTo(rope[i])<1e-9),'An early packet cannot jump the rendered line');
 assert.equal(view.player.time,time);assert.equal(view.player.bend,bend);
 client.render(view.player,view,150);assert.ok(Math.abs(view.player.position.y-initial.y-4)<1e-7);
 client.latest=make(1,2);client.render(view.player,view,160);assert.ok(Math.abs(view.player.position.y-initial.y-1)<1e-7,'A new round discards the previous interpolation');
 client.latest=make(3,2);client.latest.code='IJKLMNPQ';client.render(view.player,view,170);assert.ok(Math.abs(view.player.position.y-initial.y-3)<1e-7,'A new room cannot blend into the old one');
 // One frame per packet used to reset interpolation to zero indefinitely.
 for(let frame=1;frame<=4;frame++){client.latest=make(frame+3,2);client.latest.code='IJKLMNPQ';client.render(view.player,view,170+frame*1000);assert.ok(Math.abs(view.player.position.y-initial.y-frame-3)<1e-7,'A throttled tab must catch up instead of freezing at every packet');}
 // Even if the packet containing the cut was missed, a fresh life must not
 // sweep its new line through the previous kite's airborne location.
 client.latest=make(0,2);client.latest.code='IJKLMNPQ';client.latest.match.pilots[slot].body.lifeSerial++;
 client.render(view.player,view,4175);assert.ok(view.player.position.distanceTo(initial)<1e-7,'A new life starts at its launch, without interpolation from the old sail');assert.ok(view.player.rope.previous.every((q,i)=>q.distanceTo(view.player.rope.points[i])<1e-8));
}
console.log('PASS: jitter-free packet retargeting for both seats, line continuity, smooth paper animation, room/round resets and background-tab catch-up.');

// Slerping orientation is not the same as lerping a rotated endpoint. The
// rendered line must be repinned to the interpolated bridle knot each frame.
const rotatingRoom={...room,players:[{...room.players[0],setup:{anchorLeft:0,anchorRight:95,knotsRight:4}},room.players[1]]},match=createMatch(rotatingRoom),client=Object.create(OnlineGame.prototype),view=new Commission(new KitePhysics());client.interval=100;
rotatingRoom.match=packMatch(match);client.latest=snapshot(rotatingRoom,0,0);client.render(view.player,view,0);
match.player.heading=2.3;match.player.updateAttitude(new Vector3(.1,0,-1).normalize());match.player.rope.pin();rotatingRoom.match=packMatch(match);client.latest=snapshot(rotatingRoom,0,100);client.render(view.player,view,10);
for(const time of [30,50,70,90,110]){client.render(view.player,view,time);for(const pilot of [view.player,view.rival])assert.ok(pilot.rope.points.at(-1).distanceTo(pilot.rope.endpoint())<1e-8,'Online interpolation keeps the line attached to the common bridle knot');}
console.log('PASS: rotating asymmetric bridles stay joined during online interpolation.');
