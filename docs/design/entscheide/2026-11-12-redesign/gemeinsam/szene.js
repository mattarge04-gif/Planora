import * as THREE from '../../../../../app/web/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../../../../../app/web/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Richtungsstudie: Geometrie und Positionen sind schematisch, keine Produktimplementierung.
const galerie = document.body.dataset.ansatz === 'b';
const host = document.querySelector('#szene');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
host.appendChild(renderer.domElement);
const aspect = host.clientWidth / host.clientHeight;
const frustum = galerie ? 33 : 32;
const camera = new THREE.OrthographicCamera(-frustum*aspect/2,frustum*aspect/2,frustum/2,-frustum/2,.1,300);
camera.position.set(38, 35, 46); camera.lookAt(0,galerie ? 4 : 2.1,0);
scene.add(new THREE.HemisphereLight(0xf6f9ff, 0xd7dce1, 2.3));
const sun = new THREE.DirectionalLight(0xffffff,1.5); sun.position.set(-20,40,20);
sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-36;sun.shadow.camera.right=36;sun.shadow.camera.top=36;sun.shadow.camera.bottom=-36;sun.shadow.camera.near=1;sun.shadow.camera.far=130;sun.shadow.normalBias=.035; sun.shadow.bias=-.00015;sun.shadow.radius=8;sun.shadow.blurSamples=16;sun.shadow.intensity=.55;scene.add(sun);
const fill = new THREE.DirectionalLight(0xe8effa,.65);fill.position.set(25,14,-25);scene.add(fill);
const mats = {};
function material(color, roughness=.88) { const key=color+':'+roughness;return mats[key] ??= new THREE.MeshStandardMaterial({color,roughness}); }
const white=material('#f3f4f5'), side=material('#ced5dc'), metal=material('#b5c0c9',.48), glass=material('#d0dfe9',.32),red=material('#d92320',.65);
function box(w,h,d,x,y,z,mat=white,round=.035,parent=scene) {const mesh=new THREE.Mesh(round?new RoundedBoxGeometry(w,h,d,2,round):new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cyl(r,h,x,y,z,mat=metal,parent=scene) {const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function pipe(points,r=.065,parent=scene,mat=red) {const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');const obj=new THREE.Mesh(new THREE.TubeGeometry(curve,64,r,10,false),mat);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
// A diffused contact layer grounds the miniature without a dark outline.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
const ctx=shadowCanvas.getContext('2d');const grad=ctx.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(63,76,90,.26)');grad.addColorStop(.5,'rgba(63,76,90,.13)');grad.addColorStop(1,'rgba(63,76,90,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
function contactPatch(w,d,x,y,z,parent=scene,opacity=1){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);}
contactPatch(46,30,1,-.62,1,scene,1.4);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-.64;ground.receiveShadow=true;scene.add(ground);
box(galerie?34:39,.55,galerie?19:24,0,-.28,0,white,.18);
if(!galerie){
 box(37,.07,2.1,0,.035,9.7,material('#e7eaed'),.05);
 box(2,.07,20,-17,.035,0,material('#eceef0'),.05);
 for(let k=0;k<15;k++)box(.018,.012,2.1,-17+k*2.4,.08,9.7,material('#d9dfe4'),0);
 for(const [x,z,s] of [[-17,-8,1],[-17,5,.8],[17,-8,1.05],[17,7,.85]]){
  cyl(.11,1.4,x,.7,z,material('#c9ced1'));
  const foliage=new THREE.Mesh(new THREE.SphereGeometry(1.05*s,20,16),material('#e0e4e5'));foliage.scale.set(.88,1.35,.88);foliage.position.set(x,2.2*s,z);foliage.castShadow=true;foliage.receiveShadow=true;scene.add(foliage);
  box(2.5,.08,2.5,x,.07,z,material('#e9ecee'),.1);
 }
 for(let k=0;k<3;k++){box(2.1,.016,.07,8+k*3.2,.08,-10.6,side,.01);box(.07,.016,3.4,6.8+k*3.2,.08,-9.2,side,.01);}
}
const floors=[];
function floor(index,y){
 const group=new THREE.Group();group.position.y=y;scene.add(group);floors.push(group);
 box(30.4,.32,15.4,0,.2,0,side,.065,group);box(30,.055,15,0,.39,0,material('#e1e5e9'),.025,group);
 // Rear facade and delicate facade rhythm; front is cut to parapet height.
 box(30,2.65,.24,0,1.75,-7.38,white,.03,group);
 box(.24,2.65,15,-14.88,1.75,0,white,.03,group);
 box(30,.68,.24,0,.78,7.38,white,.035,group);
 if(!galerie)box(21.1,2.55,.24,-4.45,1.73,7.38,white,.035,group);
 box(.24,.68,15,14.88,.78,0,white,.035,group);
 for(let x=-13.5;x<15;x+=3){
  box(2.56,1.55,.07,x,1.83,-7.52,glass,.015,group);
  box(.075,1.67,.13,x-1.31,1.83,-7.56,metal,.01,group);
  box(2.7,.075,.17,x,1.02,-7.56,white,.01,group);
  box(2.7,.075,.17,x,2.65,-7.56,white,.01,group);
  // Pale glass ribbon on the cut side preserves the model's architectural presence.
  const facadeHeight=!galerie&&x<6 ? 1.55:.64;
  const facadeY=!galerie&&x<6 ? 1.83:.8;
  box(2.58,facadeHeight,.045,x,facadeY,7.53,glass,.01,group);
  box(.065,facadeHeight+.12,.13,x-1.32,facadeY,7.57,metal,.01,group);
  if(!galerie&&x<6){box(2.7,.08,.16,x,1.02,7.57,white,.01,group);box(2.7,.08,.16,x,2.65,7.57,white,.01,group);}
 }
 for(let z=-6;z<7;z+=3){box(.07,1.55,2.55,-15.025,1.83,z,glass,.01,group);box(.15,.07,2.7,-15.05,1.02,z,white,.01,group);}
 if(index===0){
  box(.2,1.1,14.8,-4,1,0,white,.02,group);box(.2,1.1,14.8,8,1,0,white,.02,group);
  box(6.7,.025,14.55,11.4,.43,0,material('#ccd7df'),.02,group);
  box(11.7,.025,14.55,2,.43,0,material('#e3e6e9'),.02,group);
  contactPatch(9,9,11.7,.46,3,group,1.2);
  pump(10,1.6,1,group);tank(13.1,1.65,1.2,group);manifold(11.7,1.25,5.3,group);
  radiator(-10,.88,-4,group);radiator(-10,.88,1,group);
  heating(-1,0.48,-3,7,8,group);
  pipe([[10.5,.58,1],[10.5,.58,3],[10.65,.58,3.3],[11.7,.58,3.3],[11.7,.58,5.2]],.075,group);
  pipe([[11.7,.58,5.3],[7.7,.58,5.3],[7.4,.58,5],[7.4,.58,3],[-.5,.58,3]],.067,group);
 }else{
  box(.2,1.05,14.8,0,1,0,white,.025,group);
  box(14.7,.025,14.55,-7.5,.43,0,material('#dce2e7'),.01,group);
  heating(-11,.48,-3,7,8,group);heating(4,.48,-3,7,8,group);
 }
 // Wall cap catches a continuous highlight. No black edge strokes.
 box(30.15,.1,.38,0,3.1,-7.38,white,.025,group);box(.38,.1,15.15,-14.88,3.1,0,white,.025,group);
 if(!galerie&&index===1){const planes=[new THREE.Plane(new THREE.Vector3(-1,0,0),7),new THREE.Plane(new THREE.Vector3(0,0,-1),0)];group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.clippingPlanes=planes;o.material.clipIntersection=true;o.material.clipShadows=true;}});}
 return group;
}
function pump(x,y,z,g){
 box(2.1,2.25,1.25,x,y,z,white,.12,g);box(1.85,.1,1.08,x,y+1.16,z,side,.025,g);
 box(1.8,.09,.08,x,y+.87,z+.65,red,.01,g);
 const fan=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.08,48),metal);fan.rotation.x=Math.PI/2;fan.position.set(x,y-.15,z+.66);g.add(fan);
 for(let a=0;a<11;a++){const bar=box(1.12,.026,.035,x,y-.63+a*.096,z+.72,white,.006,g);}
 for(const dx of [-.67,.67])box(.22,.18,.9,x+dx,y-1.2,z,metal,.02,g);
 box(.37,.24,.035,x+.5,y+.48,z+.665,material('#b8c3cc'),.018,g);
}
function tank(x,y,z,g){cyl(.65,2.45,x,y,z,white,g);cyl(.66,.1,x,y-.8,z,red,g);cyl(.61,.12,x,y+1.23,z,side,g);cyl(.52,.15,x,y-1.29,z,metal,g);pipe([[x+.6,y+.65,z],[x+.9,y+.65,z],[x+.9,.58,z],[x+1.2,.58,z]],.055,g);}
function manifold(x,y,z,g){box(2.2,1.25,.46,x,y,z,white,.065,g);box(1.95,.09,.08,x,y+.3,z+.26,red,.01,g);for(let k=0;k<6;k++){box(.065,.8,.07,x-.78+k*.3,y-.15,z+.27,metal,.01,g);cyl(.08,.09,x-.78+k*.3,y+.36,z+.27,red,g);} }
function radiator(x,y,z,g){box(2.1,.86,.36,x,y,z,white,.04,g);for(let k=0;k<13;k++)box(.075,.74,.08,x-.9+k*.15,y,z+.21,side,.015,g);box(.075,.08,.14,x+1.12,y+.22,z,red,.01,g);}
function heating(x,y,z,w,d,g){const pts=[];for(let k=0;k<6;k++){let xx=x+k*w/5;pts.push([xx,y+.045,z+(k%2?d:0)]);pts.push([xx,y+.045,z+(k%2?0:d)]);}pipe(pts,.075,g,material('#d8342e',.8));}
floor(0,0);floor(1,galerie?8.0:3.35);
if(!galerie){
 // A lifted fragment rather than a complete roof keeps the building legible as a cutaway.
 const roof=box(30.4,.28,15.4,0,6.8,0,material('#f0f2f4'),.06);roof.material=roof.material.clone();roof.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),7),new THREE.Plane(new THREE.Vector3(0,0,-1),0)];roof.material.clipIntersection=true;roof.material.clipShadows=true;
 box(30.4,.22,.28,0,7.02,-7.55,white,.025);box(.28,.22,15.4,-15.05,7.02,0,white,.025);box(22,.22,.28,-4,7.02,7.55,white,.025);
 box(4.3,.75,2.0,-8,7.3,-6.2,side,.08);
 for(let k=0;k<11;k++)box(.18,.42,.035,-9.7+k*.33,7.32,-5.18,metal,.01);
}else{
 // A precisely lit upper plate and inset footprint make separation the visual signature.
 box(30.3,.12,.38,0,11.16,-7.38,white,.025);
}
renderer.render(scene,camera);
window.__PLANORA_MOCKUP_READY__=true;
window.__PLANORA_SCENE__={renderer,scene,camera};
