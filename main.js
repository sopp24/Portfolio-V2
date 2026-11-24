import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";

/* Midnight Video — an original, procedural reconstruction of the endless VHS store. */

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const boot = $("boot");
const progress = $("boot-progress");
const hud = $("hud");
const fallback = $("fallback");

const MOVIES = [
  {title:"The Shining",year:1980,genre:"Horror",runtime:"146 MIN",rating:"R",director:"Stanley Kubrick",cast:"Jack Nicholson · Shelley Duvall · Danny Lloyd",synopsis:"A writer takes a winter caretaker job at an isolated hotel. As the snow closes in, the building begins to remember things that should have stayed buried."},
  {title:"The Thing",year:1982,genre:"Science Fiction / Horror",runtime:"109 MIN",rating:"R",director:"John Carpenter",cast:"Kurt Russell · Wilford Brimley · Keith David",synopsis:"An isolated Antarctic research team discovers a life-form capable of imitating anything it touches. Trust is the first thing to disappear."},
  {title:"Alien",year:1979,genre:"Science Fiction / Horror",runtime:"117 MIN",rating:"R",director:"Ridley Scott",cast:"Sigourney Weaver · Tom Skerritt · John Hurt",synopsis:"A commercial starship answers a distress signal on a remote moon. Something comes aboard, and the return journey becomes a fight for survival."},
  {title:"Blade Runner",year:1982,genre:"Science Fiction",runtime:"117 MIN",rating:"R",director:"Ridley Scott",cast:"Harrison Ford · Rutger Hauer · Sean Young",synopsis:"In a rain-soaked future Los Angeles, a retired detective is pulled back into a world where the line between human and artificial memory has worn thin."},
  {title:"Videodrome",year:1983,genre:"Body Horror",runtime:"87 MIN",rating:"R",director:"David Cronenberg",cast:"James Woods · Deborah Harry · Sonja Smits",synopsis:"A late-night television programmer discovers a broadcast signal that seems to alter its viewers. The screen becomes a door, and the body becomes the receiver."},
  {title:"Possession",year:1981,genre:"Psychological Horror",runtime:"124 MIN",rating:"Not Rated",director:"Andrzej Żuławski",cast:"Isabelle Adjani · Sam Neill · Heinz Bennent",synopsis:"A marriage fractures in a divided Berlin. Jealousy, grief and something unnameable spill into the streets and apartments around it."},
  {title:"Brazil",year:1985,genre:"Dystopian / Fantasy",runtime:"132 MIN",rating:"R",director:"Terry Gilliam",cast:"Jonathan Pryce · Kim Greist · Robert De Niro",synopsis:"A low-level clerk escapes the machinery of a suffocating bureaucracy through impossible dreams, while a small clerical error grows into a nightmare."},
  {title:"Akira",year:1988,genre:"Anime / Science Fiction",runtime:"124 MIN",rating:"R",director:"Katsuhiro Otomo",cast:"Mitsuo Iwata · Nozomu Sasaki · Mami Koyama",synopsis:"In Neo-Tokyo, a biker gang is caught in the aftermath of a secret military experiment. A city on the edge of collapse meets a power no one can contain."},
  {title:"Ghost in the Shell",year:1995,genre:"Anime / Science Fiction",runtime:"83 MIN",rating:"R",director:"Mamoru Oshii",cast:"Atsuko Tanaka · Akio Ōtsuka · Iemasa Kayumi",synopsis:"A cybernetic officer hunts a mysterious hacker in a world where memory, identity and the human body are no longer fixed things."},
  {title:"Lost Highway",year:1997,genre:"Mystery / Thriller",runtime:"134 MIN",rating:"R",director:"David Lynch",cast:"Bill Pullman · Patricia Arquette · Balthazar Getty",synopsis:"A musician receives anonymous videotapes of his home. The images grow more intimate, and the identity of the person watching begins to slip."},
  {title:"Mulholland Drive",year:2001,genre:"Mystery / Thriller",runtime:"147 MIN",rating:"R",director:"David Lynch",cast:"Naomi Watts · Laura Harring · Justin Theroux",synopsis:"A woman with no memory arrives in Los Angeles. An aspiring actor helps her reconstruct a life that becomes stranger with every answer."},
  {title:"The Fly",year:1986,genre:"Body Horror",runtime:"96 MIN",rating:"R",director:"David Cronenberg",cast:"Jeff Goldblum · Geena Davis · John Getz",synopsis:"An ambitious scientist tests a teleportation device. A tiny accident sets off a transformation that science cannot reverse."},
  {title:"Eraserhead",year:1977,genre:"Surrealist Horror",runtime:"89 MIN",rating:"Not Rated",director:"David Lynch",cast:"Jack Nance · Charlotte Stewart · Allen Joseph",synopsis:"A factory worker navigates an industrial dreamscape of anxious domesticity, strange noises and a newborn that refuses to behave like anything familiar."},
  {title:"Evil Dead II",year:1987,genre:"Horror / Comedy",runtime:"84 MIN",rating:"R",director:"Sam Raimi",cast:"Bruce Campbell · Sarah Berry · Dan Hicks",synopsis:"A remote cabin, a forbidden book and a tape recorder turn a weekend away into a relentless, splattering fight against the dead."},
  {title:"Suspiria",year:1977,genre:"Supernatural Horror",runtime:"99 MIN",rating:"R",director:"Dario Argento",cast:"Jessica Harper · Stefania Casini · Joan Bennett",synopsis:"A young dancer arrives at a prestigious academy during a storm. The rooms are beautiful, the lessons are strange, and the walls seem to listen."},
  {title:"Halloween",year:1978,genre:"Slasher",runtime:"91 MIN",rating:"R",director:"John Carpenter",cast:"Jamie Lee Curtis · Donald Pleasence · Nancy Kyes",synopsis:"On a quiet suburban night, a masked figure returns to the neighbourhood where a childhood crime began. The streetlights do little to make the darkness feel safe."},
  {title:"Carrie",year:1976,genre:"Horror",runtime:"98 MIN",rating:"R",director:"Brian De Palma",cast:"Sissy Spacek · Piper Laurie · Amy Irving",synopsis:"A shy teenager discovers a terrifying ability while trying to survive school, a controlling home and a town that has never been kind to her."},
  {title:"The Warriors",year:1979,genre:"Action / Thriller",runtime:"92 MIN",rating:"R",director:"Walter Hill",cast:"Michael Beck · James Remar · Dorsey Wright",synopsis:"A gang must cross a hostile city after being blamed for a crime they did not commit. Every station, street and tunnel has its own rules."},
  {title:"A Clockwork Orange",year:1971,genre:"Crime / Science Fiction",runtime:"136 MIN",rating:"R",director:"Stanley Kubrick",cast:"Malcolm McDowell · Patrick Magee · Michael Bates",synopsis:"A young delinquent is subjected to an experimental correction programme. The film asks what remains of choice when behaviour is treated as a machine."},
  {title:"Blue Velvet",year:1986,genre:"Mystery / Neo-noir",runtime:"120 MIN",rating:"R",director:"David Lynch",cast:"Kyle MacLachlan · Isabella Rossellini · Dennis Hopper",synopsis:"A discovery in an ordinary field leads a student into the hidden rooms of a seemingly peaceful town. The grass is green; something beneath it is not."},
  {title:"The Wicker Man",year:1973,genre:"Folk Horror",runtime:"88 MIN",rating:"R",director:"Robin Hardy",cast:"Edward Woodward · Christopher Lee · Britt Ekland",synopsis:"A police sergeant arrives on a remote island to investigate a missing child. The community offers songs, smiles and answers that never quite fit."},
  {title:"Night of the Living Dead",year:1968,genre:"Horror",runtime:"96 MIN",rating:"Not Rated",director:"George A. Romero",cast:"Duane Jones · Judith O'Dea · Karl Hardman",synopsis:"Strangers barricade themselves inside a farmhouse as the dead begin to walk. Outside, the night grows crowded; inside, fear makes its own rules."},
  {title:"The Texas Chain Saw Massacre",year:1974,genre:"Horror",runtime:"83 MIN",rating:"R",director:"Tobe Hooper",cast:"Marilyn Burns · Gunnar Hansen · Paul A. Partain",synopsis:"A group of travellers stops at a remote farmhouse. The welcome is wrong, the house is wrong, and the road back is much too far."},
  {title:"Blue Thunder",year:1983,genre:"Action / Thriller",runtime:"109 MIN",rating:"R",director:"John Badham",cast:"Roy Scheider · Warren Oates · Candy Clark",synopsis:"A police helicopter pilot tests a surveillance aircraft built for the future. The machine sees everything, including things its makers would rather hide."},
  {title:"Escape from New York",year:1981,genre:"Action / Science Fiction",runtime:"99 MIN",rating:"R",director:"John Carpenter",cast:"Kurt Russell · Lee Van Cleef · Ernest Borgnine",synopsis:"A former soldier is sent into a sealed-off Manhattan to retrieve a missing passenger. The deadline is short and the city has become its own country."},
  {title:"The Crow",year:1994,genre:"Supernatural / Action",runtime:"102 MIN",rating:"R",director:"Alex Proyas",cast:"Brandon Lee · Rochelle Davis · Ernie Hudson",synopsis:"On the anniversary of a brutal night, a murdered musician returns through the rain-soaked streets to settle a debt and find a quiet ending."},
  {title:"The Blair Witch Project",year:1999,genre:"Found Footage Horror",runtime:"81 MIN",rating:"R",director:"Daniel Myrick & Eduardo Sánchez",cast:"Heather Donahue · Michael C. Williams · Joshua Leonard",synopsis:"Three filmmakers enter a forest to document a local legend. Their footage becomes the only record of a journey that does not seem to end."},
  {title:"Jacob's Ladder",year:1990,genre:"Psychological Horror",runtime:"113 MIN",rating:"R",director:"Adrian Lyne",cast:"Tim Robbins · Elizabeth Peña · Danny Aiello",synopsis:"A veteran returns to New York and begins experiencing fractured memories and impossible encounters. The past follows him in the shape of the present."},
  {title:"Videodrome: Director's Cut",year:2004,genre:"Body Horror",runtime:"89 MIN",rating:"R",director:"David Cronenberg",cast:"James Woods · Deborah Harry · Sonja Smits",synopsis:"A late-night broadcast resurfaces in an extended cut. The signal is stronger this time, and the tape has not been rewound."},
  {title:"The Fog",year:1980,genre:"Supernatural Horror",runtime:"89 MIN",rating:"R",director:"John Carpenter",cast:"Adrienne Barbeau · Jamie Lee Curtis · Janet Leigh",synopsis:"A coastal town prepares for its anniversary as a strange fog rolls in from the sea. The lights are on, but the people arriving in the mist are not invited."},
  {title:"Metropolis",year:1927,genre:"Science Fiction",runtime:"153 MIN",rating:"Not Rated",director:"Fritz Lang",cast:"Brigitte Helm · Alfred Abel · Gustav Fröhlich",synopsis:"Beneath a monumental city, workers keep the machines running. Above them, a new arrival discovers how deeply the city has divided its people."},
  {title:"The Cabinet of Dr. Caligari",year:1920,genre:"Expressionist Horror",runtime:"77 MIN",rating:"Not Rated",director:"Robert Wiene",cast:"Werner Krauss · Conrad Veidt · Friedrich Fehér",synopsis:"A travelling showman arrives with a somnambulist who predicts the future. A small town follows the clues into a world of painted shadows and unreliable truths."},
  {title:"Stalker",year:1979,genre:"Science Fiction / Drama",runtime:"162 MIN",rating:"PG",director:"Andrei Tarkovsky",cast:"Alexander Kaidanovsky · Anatoly Solonitsyn · Nikolai Grinko",synopsis:"A guide leads two men into a forbidden place where ordinary rules seem to have stopped working. Their destination may grant a wish, but none of them agrees on what they want."},
  {title:"The Passenger",year:1975,genre:"Drama / Thriller",runtime:"126 MIN",rating:"PG",director:"Michelangelo Antonioni",cast:"Jack Nicholson · Maria Schneider · Jenny Runacre",synopsis:"A journalist assumes the identity of a stranger and leaves his old life behind. The journey opens a series of questions that no passport can answer."},
  {title:"Chungking Express",year:1994,genre:"Romance / Drama",runtime:"102 MIN",rating:"PG-13",director:"Wong Kar-wai",cast:"Brigitte Lin · Takeshi Kaneshiro · Tony Leung",synopsis:"Two lonely policemen move through the same city at different hours. A snack bar, a song and a series of missed connections become their small universes."}
];

const PALETTES = [
  ["#a84e3e","#e0b47c","#182a30"],["#27465a","#d0a16d","#e1d2b8"],["#9b8b43","#2b3735","#bd473a"],
  ["#5b445d","#d8a8a0","#26343b"],["#b58a4e","#1e3941","#dbd0ad"],["#934b38","#d5c28c","#263f37"],
  ["#596c68","#b96f50","#dfd1b4"],["#473d6b","#bd7b55","#e2d7c3"]
];

let scene, camera, renderer, composer, crtPass, bokehPass, clock, playerRig, xrController;
let bokehFocus = 8;
const focusCameraPosition = new THREE.Vector3();
const focusTargetPosition = new THREE.Vector3();
const focusCameraDirection = new THREE.Vector3();
let shelfTicketGeometry=null,shelfTicketMaterial=null;
const fluorescentLights=[];
let floorSurface, ceilingSurface;
const endlessWalls = [];
const streamedFixtures = [];
let libraryResults = [];
let libraryDisplayed = 0;
let initialized = false, started = false, paused = false, isLocked = false;
let movieCatalogue = MOVIES.slice();
let tmdbToken = localStorage.getItem("midnightvideo.tmdbToken") || "";
let pointerDragging=false,pointerDragMoved=false,pointerLastX=0,pointerLastY=0,suppressCanvasClick=false;
let yaw=0,pitch=0,verticalVelocity=0,grounded=true;
let crouching = false, running = false, flashlightOn = false, flashlightBattery = 100;
let survivalMode = false, foundAnomalies = 0, selectedTarget = null, elapsedTime = 0;
let flashlight,audioContext=null,audioGain=null,ambientNoiseSource=null,ambientNoiseGain=null;
let audioMasterGain=null,tvPanner=null,tvHumGain=null,tvHumOscillators=[],footstepBuffer=null;
let footstepTimer=0,footstepIndex=0,tvStaticTexture=null,tvStaticCanvas=null,tvStaticTimer=0;
const keys = Object.create(null);
const staticInteractables = [];
const nearbyInteractables = [];
let nearbyInteractionAnchorZ = NaN;
const activeTapeAnimations = new Set();
const sideSections = [];
const aislePairs=[];
const posterQueue = [];
let posterQueueActive = 0, posterQueuePaused = false, posterQueueToken = "", posterPersistTimer = 0;
let nextAislePair=5,previousAislePair=-1;
const AISLE_LABELS = ["THRILLER","HORROR","SCI-FI","CRIME","DRAMA","CULT CLASSICS","ACTION","NO HOPE","MYSTERY","ANIMATION"];
const anomalyObjects = [];
const raycaster = new THREE.Raycaster();
raycaster.far = 5.1;
const screenCenter = new THREE.Vector2(0,0);
const player = { position: new THREE.Vector3(0,0,3.2), velocity: new THREE.Vector3() };
function isInterfacePanelOpen(){return !$("film-panel").hidden||!$("library-panel").hidden;}
function clearMovementInput(stopVelocity=false){
  for(const state of ["moveForward","moveBack","moveLeft","moveRight","Space"])keys[state]=false;
  running=false;footstepTimer=0;pointerDragging=false;
  if(stopVelocity)player.velocity.set(0,0,0);
}
const tempForward = new THREE.Vector3();
const tempRight = new THREE.Vector3();

function seeded(index, salt) {
  const x = Math.sin((index + 1) * 127.1 + (salt || 0) * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function posterCanvas(movie, index, onArtworkLoaded=null) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 192;
  const ctx = canvas.getContext("2d");ctx.scale(.5,.5);
  const colors = PALETTES[index % PALETTES.length];
  const grad = ctx.createLinearGradient(0,0,256,384);
  grad.addColorStop(0,colors[0]); grad.addColorStop(.55,colors[1]); grad.addColorStop(1,colors[2]);
  ctx.fillStyle = grad; ctx.fillRect(0,0,256,384);
  const rand = (n) => seeded(index * 8 + n, 18);
  ctx.save();
  ctx.globalAlpha = .28;
  for (let i=0;i<9;i++) {
    ctx.fillStyle = i%2 ? colors[2] : "#e6d9b8";
    ctx.beginPath();
    const x = rand(i) * 300 - 25, y = rand(i+20) * 430 - 25, r = 24 + rand(i+50)*90;
    ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,.26)";
  ctx.fillRect(0,0,256,384);
  ctx.strokeStyle = "rgba(245,237,211,.52)";
  ctx.lineWidth = 2; ctx.strokeRect(12,12,232,360);
  ctx.fillStyle = "rgba(245,237,211,.83)";
  ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
  ctx.fillText("MIDNIGHT VIDEO PRESENTS",128,34);
  const title = String(movie.title||"UNTITLED").toUpperCase();
  const words = title.split(" ");
  let lines = [], line = "";
  ctx.font = "900 31px Arial";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > 216 && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  const fontSize = lines.length > 3 ? 22 : lines.length > 2 ? 25 : 31;
  ctx.font = "900 " + fontSize + "px Arial";
  const startY = 218 - (lines.length-1)*fontSize*.52;
  lines.slice(0,4).forEach((t,i)=>ctx.fillText(t,128,startY+i*fontSize*1.12));
  ctx.fillStyle = "rgba(255,243,213,.76)";
  ctx.font = "9px monospace"; ctx.fillText(String(movie.year||"—") + "  /  " + String(movie.genre||"FEATURE").toUpperCase(),128,344);
  ctx.fillStyle = "#f5ead0"; ctx.fillRect(22,50,3,65);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(31,50,1,70);
  ctx.fillStyle = "rgba(10,10,10,.22)"; ctx.fillRect(0,0,10,384);
  if(movie.posterUrl){
    const image=new Image();image.crossOrigin="anonymous";
    image.onload=()=>{ctx.clearRect(0,0,256,384);const scale=Math.max(256/image.width,384/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(256-w)/2,(384-h)/2,w,h);if(onArtworkLoaded)onArtworkLoaded();};
    image.src=movie.posterUrl;
  }
  return canvas;
}

function addBox(parent, size, position, material, rotation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material);
  mesh.position.set(position[0],position[1],position[2]);
  if (rotation) mesh.rotation.set(rotation[0],rotation[1],rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createPosterSign(text, width, height, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#101713"; ctx.fillRect(0,0,512,128);
  ctx.strokeStyle = "rgba(220,231,208,.4)"; ctx.lineWidth = 2; ctx.strokeRect(5,5,502,118);
  ctx.fillStyle = color || "#d5dfbd"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 35px Arial"; ctx.fillText(text,256,63);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  return mesh;
}

function spineCanvas(movie,index) {
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=256;
  const ctx=canvas.getContext("2d");ctx.scale(.5,.5);
  const palette=PALETTES[index%PALETTES.length];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,256,512);
  ctx.fillStyle="rgba(0,0,0,.32)";ctx.fillRect(0,0,256,512);
  ctx.fillStyle=palette[1];ctx.fillRect(12,18,8,476);
  ctx.fillStyle="rgba(245,239,220,.84)";ctx.textAlign="center";
  ctx.save();ctx.translate(135,256);ctx.rotate(-Math.PI/2);
  const title=(movie.title||"UNTITLED").toUpperCase();
  ctx.font="bold "+(title.length>22?20:25)+"px Arial";ctx.fillText(title,0,0,470);ctx.restore();
  ctx.fillStyle="rgba(245,239,220,.7)";ctx.font="18px monospace";ctx.fillText(String(movie.year||"—"),132,482);
  ctx.fillStyle="#090c09";ctx.fillRect(0,0,256,12);ctx.fillRect(0,500,256,12);
  return canvas;
}
function addCase(parent, position, rotationY, movie, movieIndex, catalogueIndex, spineMode=false) {
  const root=new THREE.Group();
  root.position.set(position[0],position[1],position[2]);root.rotation.y=rotationY;
  root.userData.kind="movie";root.userData.movie=movie;root.userData.catalogueIndex=catalogueIndex;
  root.userData.baseZ=position[2];root.userData.pull=0;root.userData.pullTarget=0;
  root.userData.spineMode=spineMode;root.userData.coverMesh=null;root.userData.tapeTexture=null;
  root.userData.textureKey=(movie.title||"")+"|"+(movie.year||0)+"|"+(movie.genre||"")+"|"+(movie.posterUrl||"");
  root.userData.baseRotationX=root.rotation.x;
  root.userData.baseRotationY=root.rotation.y;
  const body=new THREE.Mesh(spineMode?spineCaseGeometry:caseGeometry,caseMaterial);root.add(body);
  const faceWidth=spineMode?.095:.274;
  let tapeTexture;
  const artwork=spineMode?spineCanvas(movie,movieIndex):posterCanvas(movie,movieIndex,()=>{if(tapeTexture)tapeTexture.needsUpdate=true;});
  tapeTexture=new THREE.CanvasTexture(artwork);tapeTexture.colorSpace=THREE.SRGBColorSpace;
  tapeTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  root.userData.tapeTexture=tapeTexture;
  const faceMaterial=new THREE.MeshBasicMaterial({map:tapeTexture,side:THREE.DoubleSide});
  const cover=new THREE.Mesh(new THREE.PlaneGeometry(faceWidth,.475),faceMaterial);
  cover.position.set(0,0,.054);root.add(cover);root.userData.coverMesh=cover;
  body.userData.root=root;cover.userData.root=root;
  const hitTargets=parent.userData.hitTargets;
  if(Array.isArray(hitTargets))hitTargets.push(body,cover);else staticInteractables.push(body,cover);
  parent.add(root);return root;
}
let caseGeometry, spineCaseGeometry, caseMaterial, shelfMaterial, pegboardMaterial, wallMaterial, metalMaterial, pegMaterial;

function assignSectionCatalogue(section) {
  const count=movieCatalogue.length;
  if(!count||!section.userData.caseRoots)return;
  const base=(section.userData.streamIndex||0)*88;
  section.userData.caseRoots.forEach(root=>{
    const slot=base+root.userData.slotOffset;
    const index=((slot%count)+count)%count;
    const movie=movieCatalogue[index];
    if(root.userData.assignedStreamIndex!==section.userData.streamIndex){
      root.userData.pull=0;root.userData.pullTarget=0;
      root.position.z=root.userData.baseZ;
      root.rotation.x=root.userData.baseRotationX||0;root.rotation.y=root.userData.baseRotationY||0;
      activeTapeAnimations.delete(root);
      if(selectedTarget===root){
        selectedTarget=null;
        $("crosshair").classList.remove("active");$("interaction-hint").hidden=true;
        $("look-hint").style.opacity=started?"0.9":"0";
      }
      root.userData.assignedStreamIndex=section.userData.streamIndex;
    }
    root.userData.movie=movie;root.userData.catalogueIndex=index;
    const textureKey=(movie.title||"")+"|"+(movie.year||0)+"|"+(movie.genre||"")+"|"+(movie.posterUrl||"");
    if(root.userData.textureKey===textureKey)return;
    const tapeTexture=root.userData.tapeTexture;
    if(tapeTexture){
      const artwork=root.userData.spineMode?spineCanvas(movie,index):posterCanvas(movie,index,()=>{tapeTexture.needsUpdate=true;});
      tapeTexture.image=artwork;tapeTexture.needsUpdate=true;root.userData.textureKey=textureKey;
    }
  });
}
function createShelfModule(side, centerZ, segmentNumber, aisleIndex=segmentNumber%10) {
  const parent=new THREE.Group();
  parent.position.set(side*4.45,0,centerZ);
  parent.rotation.y=side===-1?Math.PI/2:-Math.PI/2;
  parent.userData.streamIndex=segmentNumber;parent.userData.side=side;parent.userData.aisleIndex=aisleIndex;parent.userData.caseRoots=[];parent.userData.hitTargets=[];
  addBox(parent,[8.15,4.3,.12],[0,2.2,-.48],pegboardMaterial);
  const levels=[.52,1.46,2.40,3.34];
  levels.forEach((y,level)=>{
    addBox(parent,[8.35,.10,1.1],[0,y,0],shelfMaterial);
    addBox(parent,[8.3,.045,.055],[0,y+.075,.43],metalMaterial);
    if(shelfTicketGeometry&&shelfTicketMaterial){
      const ticket=new THREE.Mesh(shelfTicketGeometry,shelfTicketMaterial);
      ticket.position.set(0,y+.12,.492);ticket.renderOrder=1;parent.add(ticket);
    }
    for(let i=0;i<22;i++){
      const slot=segmentNumber*88+level*22+i;
      const movieIndex=((slot%movieCatalogue.length)+movieCatalogue.length)%movieCatalogue.length;
      const movie=movieCatalogue[movieIndex],x=(i-10.5)*.36;
      const faceOut=(i%4===0)||(level===1&&i%4===2);
      const root=addCase(parent,[x,y+.43,.18],0,movie,movieIndex,movieIndex,!faceOut);
      root.userData.slotOffset=level*22+i;root.userData.assignedStreamIndex=segmentNumber;parent.userData.caseRoots.push(root);
    }
  });
  for(let i=0;i<7;i++)addBox(parent,[.08,4.3,.16],[-3.95+i*1.31,2.2,-.38],metalMaterial);
  for(let i=0;i<11;i++)addBox(parent,[.018,3.75,.014],[-3.6+i*.72,2.2,-.407],pegMaterial);
  const label=createPosterSign(AISLE_LABELS[((aisleIndex%AISLE_LABELS.length)+AISLE_LABELS.length)%AISLE_LABELS.length],2.2,.36,aisleIndex%4===3?"#c77c62":"#d7dfc1");
  label.position.set(0,4.48,-.35);parent.add(label);parent.userData.aisleSign=label;
  sideSections.push(parent);scene.add(parent);return parent;
}

function createEndWall() {
  const wall = new THREE.Group();
  wall.position.set(0,0,-30);
  addBox(wall,[18,5.3,.22],[0,2.65,-.3],wallMaterial);
  for(let level=0;level<4;level++){
    const y=.55+level*.93;
    addBox(wall,[17.5,.11,1.1],[0,y,0],shelfMaterial);
    addBox(wall,[17.45,.05,.05],[0,y+.07,.49],metalMaterial);
    for(let i=0;i<28;i++){
      const movieIndex=(i*5+level*9+6)%movieCatalogue.length;
      const x=(i-13.5)*.62;
      addCase(wall,[x,y+.43,.18],0,movieCatalogue[movieIndex],movieIndex,500+level*30+i);
    }
  }
  const sign=createPosterSign("MEMBERSHIP REQUIRED",3.2,.8,"#d5d7c8");
  sign.position.set(0,4.3,.03);
  wall.add(sign);
  scene.add(wall);
  return wall;
}

function createWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b09);
  scene.fog = new THREE.FogExp2(0x080b09,.033);

  camera = new THREE.PerspectiveCamera(69,window.innerWidth/window.innerHeight,.1,160);
  camera.position.set(0,1.68,0);camera.rotation.order="YXZ";camera.rotation.set(pitch,0,0);

  renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance",alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=false;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const ambient=new THREE.HemisphereLight(0xc4d0c2,0x121510,1.18);
  scene.add(ambient);
  const keyLight=new THREE.PointLight(0xc7d8bf,23,27,1.8);
  keyLight.position.set(0,4.55,-1); keyLight.castShadow=true; keyLight.shadow.mapSize.set(1024,1024); scene.add(keyLight);
  const sideLight1=new THREE.PointLight(0x9bb2c4,11,18,2);
  sideLight1.position.set(3.8,3.8,9); scene.add(sideLight1);
  const sideLight2=new THREE.PointLight(0xb8bea0,10,19,2);
  sideLight2.position.set(-3.8,3.8,-13); scene.add(sideLight2);

  const floorCanvas=document.createElement("canvas"); floorCanvas.width=512; floorCanvas.height=512;
  const fctx=floorCanvas.getContext("2d"); fctx.fillStyle="#252a25"; fctx.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=64) for(let x=0;x<512;x+=64){
    fctx.fillStyle=((x/64+y/64)%2===0)?"#2b302b":"#222722"; fctx.fillRect(x+1,y+1,62,62);
  }
  for(let i=0;i<1800;i++){
    fctx.fillStyle="rgba(0,0,0,"+(Math.random()*.13)+")";
    fctx.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*5,1+Math.random()*4);
  }
  const floorTex=new THREE.CanvasTexture(floorCanvas); floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(3,710); floorTex.colorSpace=THREE.SRGBColorSpace;
  const floorMat=new THREE.MeshStandardMaterial({map:floorTex,roughness:.94,metalness:.03});
  floorSurface=new THREE.Mesh(new THREE.PlaneGeometry(11,4000),floorMat);
  floorSurface.rotation.x=-Math.PI/2;floorSurface.position.set(0,-.055,player.position.z);floorSurface.receiveShadow=true;scene.add(floorSurface);
  const ceilingMat=new THREE.MeshStandardMaterial({color:0x141a16,roughness:.95});
  ceilingSurface=new THREE.Mesh(new THREE.PlaneGeometry(11,4000),ceilingMat);
  ceilingSurface.rotation.x=Math.PI/2;ceilingSurface.position.set(0,5.15,player.position.z);scene.add(ceilingSurface);
  wallMaterial=new THREE.MeshStandardMaterial({color:0x151c17,roughness:.96});
  const leftWall=addBox(scene,[.18,5.2,4000],[-5.3,2.55,player.position.z],wallMaterial);
  const rightWall=addBox(scene,[.18,5.2,4000],[5.3,2.55,player.position.z],wallMaterial);
  endlessWalls.push(leftWall,rightWall);

  shelfMaterial=new THREE.MeshStandardMaterial({color:0x333a36,roughness:.68,metalness:.45});
  const ticketCanvas=document.createElement("canvas");ticketCanvas.width=2048;ticketCanvas.height=32;
  const ticketCtx=ticketCanvas.getContext("2d");
  ticketCtx.fillStyle="#384039";ticketCtx.fillRect(0,0,2048,32);
  ticketCtx.fillStyle="rgba(8,12,9,.35)";ticketCtx.fillRect(0,0,2048,3);ticketCtx.fillRect(0,29,2048,3);
  ticketCtx.strokeStyle="rgba(221,226,207,.42)";ticketCtx.lineWidth=1;ticketCtx.strokeRect(2,2,2044,28);
  ticketCtx.fillStyle="#d9d9c4";ticketCtx.font="bold 14px monospace";ticketCtx.textBaseline="middle";
  for(let x=18;x<2048;x+=512){
    ticketCtx.fillText("RENTAL COPY",x,16);
    ticketCtx.fillStyle="#b6bda7";ticketCtx.font="12px monospace";ticketCtx.fillText("RETURN BY MIDNIGHT",x+126,16);
    ticketCtx.fillStyle="#d9d9c4";ticketCtx.font="bold 14px monospace";ticketCtx.fillText("$0.99 / 3 NIGHTS",x+330,16);
    ticketCtx.strokeStyle="rgba(221,226,207,.38)";ticketCtx.beginPath();ticketCtx.moveTo(x+488,7);ticketCtx.lineTo(x+488,25);ticketCtx.stroke();
  }
  const ticketTexture=new THREE.CanvasTexture(ticketCanvas);ticketTexture.colorSpace=THREE.SRGBColorSpace;ticketTexture.anisotropy=2;
  shelfTicketGeometry=new THREE.PlaneGeometry(8.05,.085);
  shelfTicketMaterial=new THREE.MeshBasicMaterial({map:ticketTexture,side:THREE.DoubleSide,depthWrite:false});
  const pegCanvas=document.createElement("canvas");pegCanvas.width=512;pegCanvas.height=512;
  const pg=pegCanvas.getContext("2d");pg.fillStyle="#222b26";pg.fillRect(0,0,512,512);
  for(let y=9;y<512;y+=18)for(let x=9;x<512;x+=18){pg.fillStyle="#101713";pg.beginPath();pg.arc(x,y,2.25,0,Math.PI*2);pg.fill();pg.fillStyle="rgba(116,132,116,.12)";pg.beginPath();pg.arc(x-1,y-1,1.2,0,Math.PI*2);pg.fill();}
  const pegTex=new THREE.CanvasTexture(pegCanvas);pegTex.wrapS=pegTex.wrapT=THREE.RepeatWrapping;pegTex.repeat.set(3,2);
  pegboardMaterial=new THREE.MeshStandardMaterial({map:pegTex,color:0xffffff,roughness:.9});
  metalMaterial=new THREE.MeshStandardMaterial({color:0x59625b,roughness:.45,metalness:.7});
  pegMaterial=new THREE.MeshStandardMaterial({color:0x111713,roughness:.8});
  caseMaterial=new THREE.MeshStandardMaterial({color:0x20251f,roughness:.46,metalness:.035});
  // Reuse a softly rounded mould for every cassette instead of allocating per-tape bevels.
  caseGeometry=new RoundedBoxGeometry(.292,.52,.105,2,.012);
  spineCaseGeometry=new RoundedBoxGeometry(.105,.52,.105,2,.009);
  for(let i=0;i<5;i++){
    const z=-16+i*8;
    const left=createShelfModule(-1,z,i*2,i);
    const right=createShelfModule(1,z,i*2+1,i);
    aislePairs.push({z,left,right,index:i});
  }
  // Streamed fluorescent fittings: metal housing, luminous diffuser and a soft ceiling spill.
  const fixtureHousingMaterial=new THREE.MeshStandardMaterial({color:0x252d27,metalness:.58,roughness:.38});
  const fixtureTubeMaterial=new THREE.MeshBasicMaterial({color:0xe4ecd9});
  const fixtureGlowMaterial=new THREE.MeshBasicMaterial({color:0xc3d7bd,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false});
  const fixtureHousingGeometry=new THREE.BoxGeometry(.43,.12,3.82);
  const fixtureTubeGeometry=new THREE.BoxGeometry(.16,.026,3.48);
  const fixtureEndGeometry=new THREE.BoxGeometry(.24,.075,.075);
  const fixtureGlowGeometry=new THREE.PlaneGeometry(2.35,3.8);
  for(let i=0;i<13;i++){
    const fixtureGroup=new THREE.Group();fixtureGroup.position.z=24-i*6;
    const housing=new THREE.Mesh(fixtureHousingGeometry,fixtureHousingMaterial);
    housing.position.set(0,5.01,0);housing.castShadow=false;housing.receiveShadow=false;fixtureGroup.add(housing);
    const diffuser=new THREE.Mesh(fixtureTubeGeometry,fixtureTubeMaterial);
    diffuser.position.set(0,4.94,0);fixtureGroup.add(diffuser);
    for(const z of [-1.86,1.86]){
      const cap=new THREE.Mesh(fixtureEndGeometry,fixtureHousingMaterial);
      cap.position.set(0,4.965,z);fixtureGroup.add(cap);
    }
    const glow=new THREE.Mesh(fixtureGlowGeometry,fixtureGlowMaterial);
    glow.rotation.x=-Math.PI/2;glow.position.set(0,4.885,0);fixtureGroup.add(glow);
    const light=new THREE.PointLight(0xd1dec4,7.5,11,2);light.position.set(0,4.88,0);fixtureGroup.add(light);
    fluorescentLights.push({light,baseIntensity:7.5,phase:i*1.73});
    scene.add(fixtureGroup);streamedFixtures.push(fixtureGroup);
  }
  const backSign=createPosterSign("OPEN 24 HOURS. ALWAYS.",4.5,.55,"#d4e0c4");
  backSign.position.set(0,4.55,-12); backSign.rotation.y=0; scene.add(backSign);
  const aisleSign=createPosterSign("THRILLER  /  SCI-FI",3.2,.45,"#d4e0c4");
  aisleSign.position.set(0,4.48,10);aisleSign.rotation.y=Math.PI;scene.add(aisleSign);
  const noHopeSign=createPosterSign("NO HOPE",1.8,.42,"#d48a78");noHopeSign.position.set(-4.9,4.18,-20);noHopeSign.rotation.y=Math.PI/2;scene.add(noHopeSign);
  const staffSign=createPosterSign("STAFF ONLY",1.55,.34,"#c7cbb8");staffSign.position.set(4.9,4.2,-28);staffSign.rotation.y=-Math.PI/2;scene.add(staffSign);

  // A little TV and counter detail in the corner of the store.
  const counter=addBox(scene,[1.8,1.1,1.1],[3.75,.55,-20],new THREE.MeshStandardMaterial({color:0x242b26,roughness:.82}));
  const tv=addBox(scene,[.85,.63,.19],[3.72,2.1,-20.1],new THREE.MeshStandardMaterial({color:0x030605,roughness:.2,metalness:.2}));
  tvStaticTexture=createStaticTexture();tvStaticCanvas=tvStaticTexture.image;
  const tvScreen=new THREE.Mesh(new THREE.PlaneGeometry(.72,.48),new THREE.MeshBasicMaterial({map:tvStaticTexture}));
  tvScreen.position.set(3.72,2.1,-19.995); tvScreen.rotation.y=Math.PI/2; scene.add(tvScreen);

  flashlight=new THREE.SpotLight(0xe2e8c9,0,13,Math.PI/6,.55,1.25);
  flashlight.position.set(0,0,0);flashlight.target.position.set(0,0,-1);
  camera.add(flashlight);camera.add(flashlight.target);
  playerRig=new THREE.Group();playerRig.position.copy(player.position);playerRig.add(camera);scene.add(playerRig);
  xrController=renderer.xr.getController(0);xrController.addEventListener("select",interactFromXR);scene.add(xrController);

  createAnomalies();
  createPostprocessing();
}

function createStaticTexture() {
  const c=document.createElement("canvas"); c.width=128; c.height=96;
  const ctx=c.getContext("2d");
  for(let i=0;i<900;i++){
    ctx.fillStyle=Math.random()>.5?"rgba(230,240,222,.48)":"rgba(0,0,0,.62)";
    ctx.fillRect(Math.random()*128,Math.random()*96,1+Math.random()*3,1);
  }
  ctx.fillStyle="rgba(230,240,222,.45)"; ctx.font="8px monospace"; ctx.fillText("NO SIGNAL",37,84);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function updateStaticTexture() {
  if(!tvStaticCanvas||!tvStaticTexture)return;
  const ctx=tvStaticCanvas.getContext("2d");
  ctx.fillStyle="#08100b";ctx.fillRect(0,0,128,96);
  const drift=Math.floor(elapsedTime*37)%96;
  for(let i=0;i<42;i++){
    const y=(i*17+drift)%96;
    ctx.fillStyle=i%5===0?"rgba(224,237,219,.22)":"rgba(150,170,145,.10)";
    ctx.fillRect(0,y,128,Math.random()<.12?2:1);
  }
  for(let i=0;i<150;i++){
    const shade=Math.random()>.5?230:8;
    ctx.fillStyle=shade>100?"rgba(224,237,219,.42)":"rgba(0,0,0,.7)";
    ctx.fillRect(Math.random()*128,Math.random()*96,1+Math.random()*2,1);
  }
  ctx.fillStyle="rgba(230,240,222,.62)";ctx.font="8px monospace";
  ctx.fillText("NO SIGNAL",37+(Math.random()>.88?1:0),84);
  tvStaticTexture.needsUpdate=true;
}

function createAnomalies() {
  const red=new THREE.MeshStandardMaterial({color:0x74352c,emissive:0x63120e,emissiveIntensity:.55,roughness:.45});
  const pale=new THREE.MeshStandardMaterial({color:0xaaa997,emissive:0x20251e,emissiveIntensity:.22,roughness:.7});
  const dark=new THREE.MeshStandardMaterial({color:0x080c09,roughness:.92});
  const metal=new THREE.MeshStandardMaterial({color:0x747c70,metalness:.72,roughness:.35});
  for(let i=0;i<38;i++){
    const group=new THREE.Group();let target;const type=i%8;
    if(type===0){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),pale);group.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(.048,12,10),red);pupil.position.z=.105;group.add(pupil);target=eye;
    }else if(type===1){
      const tape=new THREE.Mesh(new THREE.BoxGeometry(.32,.20,.06),dark);group.add(tape);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(.22,.08),new THREE.MeshBasicMaterial({color:0x9f3024}));label.position.z=.034;group.add(label);target=tape;
    }else if(type===2){
      const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,1),red);group.add(orb);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.009,5,28),new THREE.MeshBasicMaterial({color:0xb45a4e,transparent:true,opacity:.65}));group.add(ring);target=orb;
    }else if(type===3){
      const head=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),dark);head.position.y=.22;group.add(head);
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.30,3,6),dark);body.position.y=-.02;group.add(body);target=body;
    }else if(type===4){
      const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.48,8),pale);group.add(lamp);
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),red);glow.position.y=.25;group.add(glow);target=lamp;
    }else if(type===5){
      const skull=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),pale);group.add(skull);
      const jaw=new THREE.Mesh(new THREE.BoxGeometry(.18,.07,.14),dark);jaw.position.y=-.12;group.add(jaw);
      const eye1=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),red);eye1.position.set(-.06,.025,.12);group.add(eye1);
      const eye2=eye1.clone();eye2.position.x=.06;group.add(eye2);target=skull;
    }else if(type===6){
      const shell=new THREE.Mesh(new THREE.BoxGeometry(.34,.23,.07),metal);group.add(shell);
      const reel1=new THREE.Mesh(new THREE.TorusGeometry(.045,.012,6,12),red);reel1.position.set(-.08,0,.04);group.add(reel1);
      const reel2=reel1.clone();reel2.position.x=.08;group.add(reel2);target=shell;
    }else{
      const shape=new THREE.Mesh(new THREE.TorusKnotGeometry(.10,.035,48,8,2,3),red);group.add(shape);target=shape;
    }
    group.position.set((seeded(i,2)-.5)*6.2,.48+(i%4)*.92,.60);
    group.rotation.y=(seeded(i,5)-.5)*.6;group.visible=false;
    group.userData.kind="anomaly";group.userData.found=false;group.userData.index=i;
    group.userData.baseY=group.position.y;group.userData.floatPhase=seeded(i,11)*Math.PI*2;
    group.userData.floatSpeed=.72+(i%5)*.11;group.userData.floatAmount=.018+(i%3)*.009;
    group.userData.baseRotationX=group.rotation.x;
    const section=sideSections[i%sideSections.length];section.add(group);
    anomalyObjects.push(group);section.userData.hitTargets.push(target);target.userData.root=group;
  }
}

function getNearbyInteractables() {
  if(!Number.isFinite(nearbyInteractionAnchorZ)||Math.abs(player.position.z-nearbyInteractionAnchorZ)>=2){
    nearbyInteractionAnchorZ=player.position.z;
    nearbyInteractables.length=0;
    nearbyInteractables.push(...staticInteractables);
    for(const section of sideSections){
      if(Math.abs(section.position.z-player.position.z)<=9.5&&Array.isArray(section.userData.hitTargets)){
        nearbyInteractables.push(...section.userData.hitTargets);
      }
    }
  }
  return nearbyInteractables;
}

const CRTShader = {
  uniforms:{tDiffuse:{value:null},time:{value:0},resolution:{value:new THREE.Vector2(1,1)}},
  vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:[
    "uniform sampler2D tDiffuse;",
    "uniform float time;",
    "uniform vec2 resolution;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec2 uv=vUv;",
    "  vec2 centered=uv-.5;",
    "  float barrel=dot(centered,centered);",
    "  uv += centered*barrel*.035;",
    "  float chroma=.0012+barrel*.0015;",
    "  float r=texture2D(tDiffuse,uv+vec2(chroma,0.0)).r;",
    "  float g=texture2D(tDiffuse,uv).g;",
    "  float b=texture2D(tDiffuse,uv-vec2(chroma,0.0)).b;",
    "  vec3 color=vec3(r,g,b);",
    "  float scan=.975+.025*sin(uv.y*resolution.y*1.2);",
    "  float vignette=1.0-smoothstep(.28,.82,length(centered));",
    "  float noise=fract(sin(dot(uv*resolution+time,vec2(12.9898,78.233)))*43758.5453)-.5;",
    "  color*=scan*(.66+.34*vignette);",
    "  color+=noise*.012;",
    "  gl_FragColor=vec4(color,1.0);",
    "}"
  ].join("\n")
};

function createPostprocessing() {
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bokehPass=new BokehPass(scene,camera,{focus:8,aperture:0.000018,maxblur:0.007,width:window.innerWidth,height:window.innerHeight});
  // Depth of field is reserved for fine-pointer desktops; touch devices keep the faster crisp render.
  bokehPass.enabled=window.matchMedia("(min-width: 761px) and (pointer: fine)").matches;
  composer.addPass(bokehPass);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),.36,.55,.76));
  crtPass=new ShaderPass(CRTShader);
  crtPass.uniforms.resolution.value.set(window.innerWidth*renderer.getPixelRatio(),window.innerHeight*renderer.getPixelRatio());
  composer.addPass(crtPass);
  composer.addPass(new OutputPass());
}

function updateResize() {
  if(!renderer||!camera) return;
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  if(composer) composer.setSize(window.innerWidth,window.innerHeight);
  if(crtPass) crtPass.uniforms.resolution.value.set(window.innerWidth*renderer.getPixelRatio(),window.innerHeight*renderer.getPixelRatio());
}

function showToast(message) {
  const toast=$("toast"); toast.textContent=message; toast.classList.add("visible");
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove("visible"),2200);
}

function requestLock() {
  const touchDevice=window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if(!renderer||paused||touchDevice) return;
  if(renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
}

function onPointerLockChange() {
  isLocked=document.pointerLockElement===renderer.domElement;
  if(started && !isLocked && (!$("film-panel").hidden || !$("library-panel").hidden)) return;
  if(started && !isLocked && $("film-panel").hidden && $("library-panel").hidden){
    paused=true; $("pause-screen").hidden=false;
  } else if(isLocked){
    paused=false; $("pause-screen").hidden=true;
  }
}

function enterStore() {
  if(!initialized || started) return;
  started=true;paused=false;boot.classList.add("leaving");
  hud.classList.add("visible");hud.setAttribute("aria-hidden","false");
  $("look-hint").style.opacity=".9";$("hud-bottom").hidden=false;
  $("mobile-controls").hidden=!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches);
  $("help-toggle").hidden=false;
  clock.start();
  queueVisiblePosters();
}

function updateCamera() {
  if(playerRig){
    playerRig.position.set(player.position.x,player.position.y,player.position.z);playerRig.rotation.y=yaw;
    camera.position.set(0,crouching?.95:1.68,0);camera.rotation.set(pitch,0,0,"YXZ");
  }else{
    camera.rotation.set(pitch,yaw,0,"YXZ");camera.position.set(player.position.x,player.position.y+(crouching?.95:1.68),player.position.z);
  }
}

function updateMovement(delta) {
  if(!started || paused || isInterfacePanelOpen()) return;
  const speed=running?6.6:3.35;
  let axisX=(keys.moveRight?1:0)-(keys.moveLeft?1:0);
  let axisZ=(keys.moveBack?1:0)-(keys.moveForward?1:0);
  if(renderer?.xr?.isPresenting){
    const sources=renderer.xr.getSession()?.inputSources||[];
    for(const source of sources){
      const axes=source.gamepad?.axes||[];
      const x=axes.length>2?axes[2]:axes[0],z=axes.length>3?axes[3]:axes[1];
      if(Number.isFinite(x)&&Math.abs(x)>.12)axisX=x;
      if(Number.isFinite(z)&&Math.abs(z)>.12)axisZ=z;
      if(source.gamepad?.buttons?.[0]?.pressed&&grounded){verticalVelocity=5.2;grounded=false;}
      if(source.gamepad?.buttons?.[1]?.pressed&&!flashlightOn)setFlashlight(true);
    }
  }
  if(renderer?.xr?.isPresenting){
    const xrCamera=renderer.xr.getCamera(camera);
    xrCamera.getWorldDirection(tempForward);tempForward.y=0;tempForward.normalize();
    tempRight.crossVectors(tempForward,new THREE.Vector3(0,1,0)).normalize();
  }else{
    tempForward.set(-Math.sin(yaw),0,-Math.cos(yaw));
    tempRight.set(Math.cos(yaw),0,-Math.sin(yaw));
  }
  const desired=new THREE.Vector3();
  desired.addScaledVector(tempRight,axisX);
  desired.addScaledVector(tempForward,-axisZ);
  if(desired.lengthSq()>0) desired.normalize().multiplyScalar(speed*(crouching?.46:1));
  const accel=1-Math.exp(-10*delta);
  player.velocity.x+=(desired.x-player.velocity.x)*accel;
  player.velocity.z+=(desired.z-player.velocity.z)*accel;
  player.position.x+=player.velocity.x*delta;
  player.position.z+=player.velocity.z*delta;
  player.position.x=THREE.MathUtils.clamp(player.position.x,-3.75,3.75);

  if(keys.Space && grounded){verticalVelocity=5.2;grounded=false;keys.Space=false;}
  verticalVelocity-=14*delta;
  player.position.y+=verticalVelocity*delta;
  if(player.position.y<=0){player.position.y=0;verticalVelocity=0;grounded=true;}
  updateWorldStreaming();
  updateCamera();
}

function refreshAisleSign(section) {
  const label=section.userData.aisleSign;
  if(!label)return;
  const index=((section.userData.aisleIndex%AISLE_LABELS.length)+AISLE_LABELS.length)%AISLE_LABELS.length;
  const next=createPosterSign(AISLE_LABELS[index],2.2,.36,index%4===3?"#c77c62":"#d7dfc1");
  const map=next.material.map;next.material.map=null;next.material.dispose();next.geometry.dispose();
  if(label.material.map)label.material.map.dispose();
  label.material.map=map;label.material.needsUpdate=true;
}
function updateWorldStreaming() {
  let sectionsStreamed=false;
  for(const pair of aislePairs){
    const delta=pair.z-player.position.z;
    if(delta>24){
      pair.z-=40;pair.left.position.z=pair.z;pair.right.position.z=pair.z;
      nearbyInteractionAnchorZ=NaN;sectionsStreamed=true;
      pair.index=nextAislePair++;
      pair.left.userData.streamIndex=pair.index*2;pair.right.userData.streamIndex=pair.index*2+1;
      pair.left.userData.aisleIndex=pair.index;pair.right.userData.aisleIndex=pair.index;
      assignSectionCatalogue(pair.left);assignSectionCatalogue(pair.right);
      refreshAisleSign(pair.left);refreshAisleSign(pair.right);
    }else if(delta < -24){
      pair.z+=40;pair.left.position.z=pair.z;pair.right.position.z=pair.z;
      nearbyInteractionAnchorZ=NaN;sectionsStreamed=true;
      pair.index=previousAislePair--;
      pair.left.userData.streamIndex=pair.index*2;pair.right.userData.streamIndex=pair.index*2+1;
      pair.left.userData.aisleIndex=pair.index;pair.right.userData.aisleIndex=pair.index;
      assignSectionCatalogue(pair.left);assignSectionCatalogue(pair.right);
      refreshAisleSign(pair.left);refreshAisleSign(pair.right);
    }
  }
  for(const fixture of streamedFixtures){
    const delta=fixture.position.z-player.position.z;
    if(delta>27)fixture.position.z-=78;
    else if(delta < -27)fixture.position.z+=78;
  }
  if(floorSurface)floorSurface.position.z=player.position.z;
  if(ceilingSurface)ceilingSurface.position.z=player.position.z;
  endlessWalls.forEach(wall=>wall.position.z=player.position.z);
  if(sectionsStreamed&&started)queueVisiblePosters();
}


function updateLook() {
  raycaster.setFromCamera(screenCenter,camera);
  const hits=raycaster.intersectObjects(getNearbyInteractables(),false);
  let next=null;
  for(const hit of hits){
    const root=hit.object.userData.root;if(!root)continue;
    if(root.userData.kind==="anomaly"&&(!survivalMode||root.userData.found))continue;
    next=root;break;
  }
  if(selectedTarget!==next){
    if(selectedTarget&&selectedTarget.userData.kind==="movie"){
      selectedTarget.userData.pullTarget=0;
      activeTapeAnimations.add(selectedTarget);
    }
    selectedTarget=next;
    $("crosshair").classList.toggle("active",!!next);
    $("interaction-hint").hidden=!next;
    $("look-hint").style.opacity=next?"0":"0.9";
    $("interaction-hint").lastElementChild.textContent=next&&next.userData.kind==="anomaly"?"INVESTIGATE ANOMALY":"EXAMINE TAPE";
    if(next&&next.userData.kind==="movie"){
      next.userData.pullTarget=.46;
      activeTapeAnimations.add(next);
    }
  }
}


function openFilm(movie,index) {
  if(!movie)return;
  playInteractionSound("tape");
  clearMovementInput(true);
  $("film-panel").hidden=false;$("film-back").hidden=true;$("film-art").classList.remove("flipped");
  const poster=posterCanvas(movie,Math.max(0,movieCatalogue.indexOf(movie)));
  $("film-art").innerHTML="";
  const img=document.createElement("img");img.src=movie.posterUrl||poster.toDataURL("image/png");img.alt=movie.title+" VHS cover";img.className="film-art-front";
  $("flip-film").textContent="FLIP TAPE ↻";
  const backFace=document.createElement("div");backFace.className="film-art-back";
  const backHeader=document.createElement("span");backHeader.className="tape-back-header";backHeader.textContent="MIDNIGHT VIDEO / RENTAL COPY";
  const backTitle=document.createElement("strong");backTitle.textContent=movie.title.toUpperCase()+" · "+(movie.year||"—");
  const backSynopsis=document.createElement("p");backSynopsis.textContent=movie.synopsis||"PLEASE ASK THE CLERK FOR MORE INFORMATION.";
  const backDirector=document.createElement("small");backDirector.textContent="DIRECTED BY "+(movie.director||"UNKNOWN");
  const backBarcode=document.createElement("span");backBarcode.className="tape-barcode";backBarcode.textContent="||| || |||| | ||| || ||||";
  backFace.append(backHeader,backTitle,backSynopsis,backDirector,backBarcode);
  $("film-art").append(img,backFace);
  $("film-title").textContent=movie.title.toUpperCase();
  $("film-year").textContent=String(movie.year||"—");$("film-genre").textContent=(movie.genre||"FEATURE PRESENTATION").toUpperCase();
  $("film-runtime").textContent=movie.runtime||"— MIN";$("film-rating").textContent=movie.rating||"NR";
  $("film-director").textContent=movie.director||"";$("film-cast").textContent=movie.cast||"";
  $("film-synopsis").textContent=movie.synopsis||"";
  $("film-back-title").textContent=movie.title.toUpperCase()+" / "+(movie.year||"");
  $("film-back-synopsis").textContent=movie.synopsis||"";
  $("film-catalogue-id").textContent="MV—"+String(index||Math.floor(Math.random()*9999)).padStart(4,"0");
  document.exitPointerLock?.();
  if(tmdbToken)enrichMovieWithTMDB(movie).then(()=>{if(!$("film-panel").hidden&&$("film-title").textContent===movie.title.toUpperCase())renderFilmMetadata(movie);});
}

function flipFilm() {
  const art=$("film-art");
  art.classList.toggle("flipped");
  $("film-back").hidden=true;
  $("film-info").style.display="flex";
  $("flip-film").textContent=art.classList.contains("flipped")?"TURN TO FRONT ↺":"FLIP TAPE ↻";
}

function investigateAnomaly(target) {
  if(!target || target.userData.found) return;
  playInteractionSound("anomaly");
  target.userData.found=true; target.visible=false; foundAnomalies++;
  $("anomaly-count").textContent=String(foundAnomalies).padStart(2,"0")+" / 38";
  if(foundAnomalies===38) showToast("ALL 38 ANOMALIES FOUND. THE STORE REMEMBERS.");
  else showToast("ANOMALY "+String(foundAnomalies).padStart(2,"0")+" / 38 FOUND");
}

function interact() {
  if(!selectedTarget) return;
  if(selectedTarget.userData.kind==="anomaly") investigateAnomaly(selectedTarget);
  else if(selectedTarget.userData.kind==="movie") openFilm(selectedTarget.userData.movie,selectedTarget.userData.catalogueIndex);
}

function interactFromXR() {
  if(!xrController)return;
  xrController.updateMatrixWorld(true);
  const origin=xrController.getWorldPosition(new THREE.Vector3());
  const rotation=new THREE.Matrix4().extractRotation(xrController.matrixWorld);
  const direction=new THREE.Vector3(0,0,-1).applyMatrix4(rotation).normalize();
  raycaster.set(origin,direction);
  const hits=raycaster.intersectObjects(getNearbyInteractables(),false);
  for(const hit of hits){
    const root=hit.object.userData.root;
    if(!root)continue;
    if(root.userData.kind==="anomaly"&&(!survivalMode||root.userData.found))continue;
    selectedTarget=root;
    if(root.userData.kind==="movie"){
      root.userData.pullTarget=.46;
      activeTapeAnimations.add(root);
    }
    interact();
    return;
  }
  showToast("AIM AT A TAPE OR AN ANOMALY");
}

function setSurvival(enabled) {
  survivalMode=enabled;
  anomalyObjects.forEach(a=>{if(!a.userData.found)a.visible=enabled;});
  $("survival-toggle").setAttribute("aria-pressed",String(enabled));
  $("survival-counter").hidden=!enabled;
  $("anomaly-count").textContent=String(foundAnomalies).padStart(2,"0")+" / 38";
  showToast(enabled?"SURVIVAL MODE ACTIVE · 38 ANOMALIES HIDDEN IN THE AISLES":"SURVIVAL MODE DISABLED");
}

function setFlashlight(enabled) {
  flashlightOn=enabled && flashlightBattery>0;
  flashlight.intensity=flashlightOn?36:0;
  $("battery").style.opacity=flashlightOn?".95":".5";
  const mobileButton=$("mobile-flashlight");
  if(mobileButton){mobileButton.textContent=flashlightOn?"LIGHT ON":"LIGHT";mobileButton.setAttribute("aria-pressed",String(flashlightOn));}
}

function openLibrary() {
  clearMovementInput(true);
  $("library-panel").hidden=false;
  $("movie-search").value="";
  renderMovieList("");
  document.exitPointerLock?.();
}
function closePanels() {
  clearMovementInput(true);
  $("film-panel").hidden=true; $("library-panel").hidden=true;
  $("film-info").style.display="flex"; $("film-back").hidden=true;
  if(started) requestLock();
}


function appendMovieRows(){
  const list=$("movie-list"),page=libraryResults.slice(libraryDisplayed,libraryDisplayed+80);
  page.forEach(movie=>{
    const row=document.createElement("button");row.className="movie-row";row.type="button";
    const img=document.createElement("img");img.className="movie-mini";img.alt="";img.loading="lazy";
    img.src=movie.posterUrl||posterCanvas(movie,movieCatalogue.indexOf(movie)).toDataURL("image/jpeg",.58);
    const name=document.createElement("span"),title=document.createElement("strong"),director=document.createElement("small");
    title.textContent=movie.title;director.textContent=movie.director||"Metadata pending";name.append(title,director);
    const year=document.createElement("span");year.className="movie-date";year.textContent=String(movie.year||"—");
    const genreLabel=document.createElement("span");genreLabel.className="movie-genre";genreLabel.textContent=(movie.genre||"UNKNOWN").toUpperCase();
    const arrow=document.createElement("span");arrow.className="movie-arrow";arrow.textContent="↗";
    row.append(img,name,year,genreLabel,arrow);
    row.addEventListener("click",()=>{closePanels();openFilm(movie,movieCatalogue.indexOf(movie)+1);});
    list.appendChild(row);
  });
  libraryDisplayed+=page.length;
  const old=list.querySelector(".load-more");if(old)old.remove();
  if(libraryDisplayed<libraryResults.length){
    const more=document.createElement("button");more.className="load-more";more.type="button";
    more.textContent="LOAD MORE · "+(libraryResults.length-libraryDisplayed)+" REMAINING";
    more.addEventListener("click",appendMovieRows);list.appendChild(more);
  }
}
function renderMovieList(query) {
  const list=$("movie-list");list.innerHTML="";
  const q=(query||"").trim().toLowerCase(),genre=$("genre-filter").value,sort=$("library-sort").value;
  libraryResults=movieCatalogue.filter(m=>(!q||m.title.toLowerCase().includes(q)||(m.director||"").toLowerCase().includes(q)||String(m.year||"").includes(q)||(m.genre||"").toLowerCase().includes(q))&&(!genre||(m.genre||"").toLowerCase().includes(genre.toLowerCase())));
  libraryResults.sort((a,b)=>sort==="za"?b.title.localeCompare(a.title):sort==="year-desc"?(b.year||0)-(a.year||0):sort==="year-asc"?(a.year||0)-(b.year||0):a.title.localeCompare(b.title));
  libraryDisplayed=0;$("library-count").textContent=libraryResults.length+" / "+movieCatalogue.length+" TITLES";
  if(!libraryResults.length){const empty=document.createElement("p");empty.className="panel-eyebrow";empty.textContent="NO TAPES MATCH YOUR SEARCH.";list.appendChild(empty);return;}
  appendMovieRows();
}

function initializeAudioScene(AudioCtx){
  audioContext=new AudioCtx();
  audioMasterGain=audioContext.createGain();audioMasterGain.gain.value=.72;audioMasterGain.connect(audioContext.destination);

  const osc=audioContext.createOscillator();osc.type="sine";osc.frequency.value=50;
  const filter=audioContext.createBiquadFilter();filter.type="lowpass";filter.frequency.value=150;
  audioGain=audioContext.createGain();audioGain.gain.value=.020;
  osc.connect(filter);filter.connect(audioGain);audioGain.connect(audioMasterGain);osc.start();
  const hum=audioContext.createOscillator();hum.type="sine";hum.frequency.value=100;hum.connect(audioGain);hum.start();

  const noiseBuffer=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate);
  const noiseData=noiseBuffer.getChannelData(0);
  for(let i=0;i<noiseData.length;i++)noiseData[i]=(Math.random()*2-1)*.45;
  ambientNoiseSource=audioContext.createBufferSource();ambientNoiseSource.buffer=noiseBuffer;ambientNoiseSource.loop=true;
  const hissFilter=audioContext.createBiquadFilter();hissFilter.type="bandpass";hissFilter.frequency.value=1250;hissFilter.Q.value=.32;
  ambientNoiseGain=audioContext.createGain();ambientNoiseGain.gain.value=.003;
  ambientNoiseSource.connect(hissFilter);hissFilter.connect(ambientNoiseGain);ambientNoiseGain.connect(audioMasterGain);ambientNoiseSource.start();

  // Low-volume electrical buzz anchored to the TV in the back corner of the shop.
  tvPanner=audioContext.createPanner();tvPanner.panningModel="HRTF";tvPanner.distanceModel="inverse";
  tvPanner.refDistance=2.5;tvPanner.maxDistance=32;tvPanner.rolloffFactor=.7;
  if(tvPanner.positionX){tvPanner.positionX.value=3.72;tvPanner.positionY.value=2.1;tvPanner.positionZ.value=-20;}
  else tvPanner.setPosition(3.72,2.1,-20);
  tvHumGain=audioContext.createGain();tvHumGain.gain.value=.0018;tvHumGain.connect(tvPanner);tvPanner.connect(audioMasterGain);
  for(const [frequency,gain] of [[60,1],[120,.34]]){
    const tvOsc=audioContext.createOscillator();tvOsc.type="sine";tvOsc.frequency.value=frequency;
    const level=audioContext.createGain();level.gain.value=gain;
    tvOsc.connect(level);level.connect(tvHumGain);tvOsc.start();tvHumOscillators.push(tvOsc);
  }

  const stepLength=Math.floor(audioContext.sampleRate*.12);
  footstepBuffer=audioContext.createBuffer(1,stepLength,audioContext.sampleRate);
  const stepData=footstepBuffer.getChannelData(0);
  for(let i=0;i<stepLength;i++){
    const fade=1-i/stepLength;
    stepData[i]=(Math.random()*2-1)*fade*fade;
  }
}
function syncAudioListener(){
  if(!audioContext||audioContext.state!=="running")return;
  const listener=audioContext.listener;
  if(listener.positionX){
    listener.positionX.value=player.position.x;listener.positionY.value=player.position.y+1.55;listener.positionZ.value=player.position.z;
    listener.forwardX.value=-Math.sin(yaw);listener.forwardY.value=0;listener.forwardZ.value=-Math.cos(yaw);
    listener.upX.value=0;listener.upY.value=1;listener.upZ.value=0;
  }else{
    listener.setPosition(player.position.x,player.position.y+1.55,player.position.z);
    listener.setOrientation(-Math.sin(yaw),0,-Math.cos(yaw),0,1,0);
  }
}
function playFootstep(){
  if(!audioContext||!footstepBuffer||!audioMasterGain)return;
  const now=audioContext.currentTime;
  const source=audioContext.createBufferSource();source.buffer=footstepBuffer;
  const low=audioContext.createBiquadFilter();low.type="lowpass";low.frequency.value=running?620:440;
  const gain=audioContext.createGain();gain.gain.setValueAtTime(.0001,now);
  gain.gain.linearRampToValueAtTime(running?.035:.022,now+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.12);
  const pan=audioContext.createStereoPanner();pan.pan.value=footstepIndex++%2===0?-.17:.17;
  source.connect(low);low.connect(gain);gain.connect(pan);pan.connect(audioMasterGain);
  source.start(now);source.stop(now+.13);
}
function playInteractionSound(kind){
  if(!audioContext||audioContext.state!=="running"||!audioMasterGain)return;
  const now=audioContext.currentTime;
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
  const isAnomaly=kind==="anomaly";
  oscillator.type=isAnomaly?"triangle":"sine";
  oscillator.frequency.setValueAtTime(isAnomaly?340:185,now);
  oscillator.frequency.exponentialRampToValueAtTime(isAnomaly?92:72,now+(isAnomaly?.22:.11));
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.linearRampToValueAtTime(isAnomaly?.014:.009,now+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,now+(isAnomaly?.24:.13));
  oscillator.connect(gain);gain.connect(audioMasterGain);
  oscillator.start(now);oscillator.stop(now+(isAnomaly?.25:.14));
}
function toggleAudio() {
  const enabled=$("sound-toggle").getAttribute("aria-pressed")!=="true";
  $("sound-toggle").setAttribute("aria-pressed",String(enabled));
  if(enabled){
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx){$("sound-toggle").setAttribute("aria-pressed","false");showToast("AMBIENCE UNAVAILABLE IN THIS BROWSER");return;}
      if(!audioContext)initializeAudioScene(AudioCtx);
      else audioContext.resume();
      syncAudioListener();
      showToast("STORE AMBIENCE ON");
    }catch(e){$("sound-toggle").setAttribute("aria-pressed","false");console.warn(e);showToast("AMBIENCE UNAVAILABLE");}
  }else{
    footstepTimer=0;
    if(audioContext)audioContext.suspend();
    showToast("STORE AMBIENCE OFF");
  }
}

async function enterVR() {
  if(!navigator.xr || !navigator.xr.requestSession){showToast("WEBXR HEADSET NOT DETECTED");return;}
  try{
    renderer.xr.enabled=true;
    const session=await navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","bounded-floor","hand-tracking"]});
    await renderer.xr.setSession(session);
    session.addEventListener("end",()=>{if(renderer)renderer.xr.enabled=false;});
    showToast("ENTERING THE STORE IN VR");
  }catch(e){console.warn(e);showToast("VR SESSION COULD NOT START");}
}

function formatTime(seconds) {
  const s=Math.floor(seconds%60),m=Math.floor(seconds/60)%60,h=Math.floor(seconds/3600);
  return h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

function updateUI(delta) {
  if(started && !paused && !isInterfacePanelOpen()) elapsedTime+=delta;
  $("clock-readout").textContent=formatTime(elapsedTime);
  let nearest=null,nearestDistance=Infinity;
  for(const section of sideSections){const distance=Math.abs(section.position.z-player.position.z);if(distance<nearestDistance){nearest=section;nearestDistance=distance;}}
  if(nearest)$("aisle-name").textContent=AISLE_LABELS[((nearest.userData.aisleIndex%AISLE_LABELS.length)+AISLE_LABELS.length)%AISLE_LABELS.length];
  const speed=Math.sqrt(player.velocity.x*player.velocity.x+player.velocity.z*player.velocity.z);
  $("speed-readout").textContent=running&&speed>.7?"RUN":"SP";
  if(audioContext?.state==="running"&&started&&!paused&&!isInterfacePanelOpen()&&grounded&&speed>.48){
    footstepTimer+=delta;
    const interval=running?.31:crouching?.64:.47;
    if(footstepTimer>=interval){footstepTimer-=interval;playFootstep();}
  }else footstepTimer=0;
  syncAudioListener();
  if(!paused&&!isInterfacePanelOpen()){
    if(flashlightOn){
      flashlightBattery=Math.max(0,flashlightBattery-delta*.95);
      if(flashlightBattery<=0){setFlashlight(false);showToast("FLASHLIGHT BATTERY DEPLETED");}
    } else if(flashlightBattery<100){
      flashlightBattery=Math.min(100,flashlightBattery+delta*.13);
    }
  }
  $("battery-level").style.width=flashlightBattery+"%";
  $("battery-value").textContent=Math.round(flashlightBattery)+"%";
}


function animate() {
  const frame=()=>{
    if(!initialized)return;
    const delta=Math.min(clock.getDelta(),.05);
    if(started&&!paused&&!isInterfacePanelOpen())updateMovement(delta);else updateCamera();
    if(started&&!paused&&!isInterfacePanelOpen())updateLook();
    for(const tape of activeTapeAnimations){
      if(!tape.parent){activeTapeAnimations.delete(tape);continue;}
      const targetPull=tape.userData.pullTarget||0;
      tape.userData.pull=THREE.MathUtils.damp(tape.userData.pull,targetPull,7,delta);
      tape.position.z=tape.userData.baseZ+tape.userData.pull;
      const targetTilt=targetPull>.02?-.045:0;
      tape.rotation.x=THREE.MathUtils.damp(tape.rotation.x,targetTilt,8,delta);
      if(Math.abs(tape.userData.pull-targetPull)<.001&&Math.abs(tape.rotation.x-targetTilt)<.001){
        tape.userData.pull=targetPull;
        tape.position.z=tape.userData.baseZ+targetPull;
        tape.rotation.x=targetTilt;
        if(targetPull===0)activeTapeAnimations.delete(tape);
      }
    }
    if(started&&!paused&&!isInterfacePanelOpen())anomalyObjects.forEach((a,i)=>{
      if(!a.visible)return;
      const phase=elapsedTime*a.userData.floatSpeed+a.userData.floatPhase;
      a.position.y=a.userData.baseY+Math.sin(phase)*a.userData.floatAmount;
      a.rotation.y+=delta*(.18+(i%4)*.04);
      a.rotation.x=a.userData.baseRotationX+Math.sin(phase*.63)*.018;
    });
    for(const fitting of fluorescentLights){
      const pulse=Math.sin(elapsedTime*1.37+fitting.phase)*.018+Math.sin(elapsedTime*.29+fitting.phase*1.8)*.009;
      const rareDip=Math.sin(elapsedTime*.43+fitting.phase*2.1)>.999?-.12:0;
      fitting.light.intensity=fitting.baseIntensity*(1+pulse+rareDip);
    }
    updateUI(delta);
    if(started&&!paused&&!isInterfacePanelOpen()){
      tvStaticTimer+=delta;
      if(tvStaticTimer>=.17){tvStaticTimer=0;updateStaticTexture();}
    }
    if(bokehPass?.enabled){
      let desiredFocus=8;
      if(selectedTarget?.userData.kind==="movie"){
        camera.getWorldPosition(focusCameraPosition);
        camera.getWorldDirection(focusCameraDirection);
        selectedTarget.getWorldPosition(focusTargetPosition);
        focusTargetPosition.sub(focusCameraPosition);
        desiredFocus=THREE.MathUtils.clamp(focusTargetPosition.dot(focusCameraDirection),2.4,16);
      }
      bokehFocus=THREE.MathUtils.damp(bokehFocus,desiredFocus,4.5,delta);
      const focusUniform=bokehPass.uniforms?.focus;
      if(focusUniform)focusUniform.value=bokehFocus;
    }
    if(crtPass)crtPass.uniforms.time.value=elapsedTime;
    if(renderer.xr.isPresenting)renderer.render(scene,camera);
    else if(composer)composer.render();
    else renderer.render(scene,camera);
  };
  if(renderer&&renderer.setAnimationLoop)renderer.setAnimationLoop(frame);
  else {const fallbackLoop=()=>{frame();requestAnimationFrame(fallbackLoop);};fallbackLoop();}
}


function csvRows(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){field+='"';i++;}
    else if(ch==='"'){quoted=!quoted;}
    else if(ch===","&&!quoted){row.push(field);field="";}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(field);field="";if(row.some(v=>v.trim()))rows.push(row);row=[];}
    else field+=ch;
  }
  if(field.length||row.length){row.push(field);if(row.some(v=>v.trim()))rows.push(row);}
  if(!rows.length)return [];
  const headers=rows.shift().map(h=>h.trim().toLowerCase());
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])));
}
function importedMovieFromRow(row){
  const title=row.name||row.title||row["film name"]||row["movie title"];if(!title)return null;
  const y=Number(row.year||row["release year"]||0);
  return {title,year:Number.isFinite(y)&&y>0?y:0,genre:"Unknown",runtime:"— MIN",rating:"NR",director:"Metadata pending",cast:"Connect TMDB to load cast",synopsis:"Imported from Letterboxd. Connect a TMDB read access token to load original posters and film data.",letterboxdUrl:row["letterboxd uri"]||"",posterUrl:"",tmdbId:null};
}
function movieKey(movie){return (movie.title||"").trim().toLowerCase().replace(/\s+/g," ")+"|"+(movie.year||0);}
function refreshGenreFilter(){
  const select=$("genre-filter");if(!select)return;const current=select.value;
  const genres=[...new Set(movieCatalogue.map(m=>m.genre||"Unknown"))].sort();
  select.replaceChildren();
  const all=document.createElement("option");all.value="";all.textContent="ALL GENRES";select.appendChild(all);
  genres.forEach(genre=>{
    const option=document.createElement("option");option.value=genre;option.textContent=genre.toUpperCase();select.appendChild(option);
  });
  if(genres.includes(current))select.value=current;
}
function saveImportedMovies(){
  try{
    const compact=movieCatalogue.map(m=>({title:m.title,year:m.year||0,letterboxdUrl:m.letterboxdUrl||"",tmdbId:m.tmdbId||null,posterUrl:m.posterUrl||"",posterLookupDone:!!m.posterLookupDone}));
    localStorage.setItem("midnightvideo.letterboxd",JSON.stringify(compact));
    $("tmdb-status").textContent=movieCatalogue.length.toLocaleString()+" titles stored in this browser.";
  }catch(e){$("tmdb-status").textContent="Archive too large for browser storage. Keep the original CSV export to reimport it.";}
}
function refreshTapeCatalogue(){
  if(!movieCatalogue.length)return;
  sideSections.forEach(assignSectionCatalogue);
}
function scheduleImportedMoviesSave(){
  if(posterPersistTimer)return;
  posterPersistTimer=setTimeout(()=>{posterPersistTimer=0;saveImportedMovies();},900);
}
function queueVisiblePosters(){
  if(!tmdbToken||!sideSections.length)return;
  if(posterQueueToken!==tmdbToken){
    posterQueueToken=tmdbToken;posterQueue.length=0;posterQueuePaused=false;
    movieCatalogue.forEach(movie=>{movie.posterQueued=false;});
  }
  if(posterQueuePaused)return;
  for(const section of sideSections){
    if(Math.abs(section.position.z-player.position.z)>9.5)continue;
    for(const root of section.userData.caseRoots||[]){
      const movie=root.userData.movie;
      if(root.userData.spineMode||!movie||movie.posterUrl||movie.posterLookupDone||movie.posterQueued||movie.posterLoading)continue;
      movie.posterQueued=true;posterQueue.push({movie,token:tmdbToken});
    }
  }
  pumpPosterQueue();
}
function isMovieOnNearbyShelf(movie){
  return sideSections.some(section=>Math.abs(section.position.z-player.position.z)<=9.5&&(section.userData.caseRoots||[]).some(root=>!root.userData.spineMode&&root.userData.movie===movie));
}
function pumpPosterQueue(){
  if(posterQueuePaused||!tmdbToken)return;
  while(posterQueueActive<2&&posterQueue.length){
    const job=posterQueue.shift(),movie=job.movie;
    if(!movie||job.token!==tmdbToken){if(movie)movie.posterQueued=false;continue;}
    if(movie.posterUrl||movie.posterLookupDone||movie.posterLoading||!isMovieOnNearbyShelf(movie)){movie.posterQueued=false;continue;}
    posterQueueActive++;
    loadTMDBPoster(movie,job.token).finally(()=>{
      posterQueueActive--;
      pumpPosterQueue();
    });
  }
}
async function loadTMDBPoster(movie,token){
  movie.posterLoading=true;
  try{
    const headers={Authorization:"Bearer "+token,Accept:"application/json"};
    const query=new URLSearchParams({query:movie.title,include_adult:"true"});
    if(movie.year)query.set("year",String(movie.year));
    const response=await fetch("https://api.themoviedb.org/3/search/movie?"+query,{headers});
    if(token!==tmdbToken)return;
    if(!response.ok){
      if([401,403,429].includes(response.status)){
        posterQueuePaused=true;posterQueue.length=0;
        $("tmdb-status").textContent=response.status===429?"TMDB rate limit reached. Visible poster loading is paused; reconnect later to resume.":"TMDB rejected the token. Check your Read Access Token.";
        return;
      }
      throw new Error("TMDB poster search failed: "+response.status);
    }
    const results=(await response.json()).results||[];
    const match=results.find(r=>!movie.year||!r.release_date||Number(r.release_date.slice(0,4))===Number(movie.year))||results[0];
    movie.posterLookupDone=true;
    if(!match)return;
    movie.tmdbId=match.id;
    if(match.poster_path){
      movie.posterUrl="https://image.tmdb.org/t/p/w500"+match.poster_path;
      refreshTapeCatalogue();
      scheduleImportedMoviesSave();
    }
  }catch(error){
    if(token===tmdbToken&&!posterQueuePaused){
      movie.posterLookupDone=true;
      console.warn("TMDB poster:",error);
    }
  }finally{
    movie.posterLoading=false;movie.posterQueued=false;
    if(token!==tmdbToken&&tmdbToken)queueVisiblePosters();
  }
}

function restoreImportedMovies(){
  try{const saved=localStorage.getItem("midnightvideo.letterboxd");if(saved){const data=JSON.parse(saved);if(Array.isArray(data)&&data.length)movieCatalogue=data;}}
  catch(e){console.warn("Could not restore the local Letterboxd archive.",e);}
  refreshGenreFilter();refreshTapeCatalogue();$("tmdb-token").value=tmdbToken;
}
async function importLetterboxdFiles(event){
  const files=[...(event.target.files||[])];if(!files.length)return;const imported=[];
  try{
    for(const file of files)csvRows(await file.text()).forEach(row=>{const item=importedMovieFromRow(row);if(item)imported.push(item);});
    const hasPreviousImport=!!localStorage.getItem("midnightvideo.letterboxd");
    const merged=new Map((hasPreviousImport?movieCatalogue:[]).map(m=>[movieKey(m),m]));
    imported.forEach(item=>{const key=movieKey(item),existing=merged.get(key);merged.set(key,existing?{...item,...existing,letterboxdUrl:item.letterboxdUrl||existing.letterboxdUrl||""}:item);});
    movieCatalogue=[...merged.values()].sort((a,b)=>a.title.localeCompare(b.title));
    saveImportedMovies();refreshGenreFilter();refreshTapeCatalogue();renderMovieList($("movie-search").value);queueVisiblePosters();
    showToast(imported.length+" LETTERBOXD ROWS IMPORTED");$("tmdb-status").textContent=movieCatalogue.length.toLocaleString()+" unique films loaded. Visible shelf artwork is loading progressively.";
  }catch(error){console.error(error);$("tmdb-status").textContent="CSV unreadable. Use a Letterboxd data export.";}
  finally{event.target.value="";}
}
function saveTMDBToken(){
  tmdbToken=$("tmdb-token").value.trim();try{localStorage.setItem("midnightvideo.tmdbToken",tmdbToken);}catch(e){}
  posterQueue.length=0;posterQueuePaused=false;posterQueueToken="";
  movieCatalogue.forEach(movie=>{movie.posterQueued=false;});
  $("tmdb-status").textContent=tmdbToken?"TMDB connected. Artwork loads progressively on nearby shelves; full details load when tapes are inspected.":"TMDB token cleared.";
  showToast(tmdbToken?"TMDB CONNECTION SAVED":"TMDB CONNECTION CLEARED");
  if(tmdbToken&&started)queueVisiblePosters();
}
async function enrichMovieWithTMDB(movie){
  if(!tmdbToken||movie.tmdbLoaded||movie.tmdbLoading)return;movie.tmdbLoading=true;
  try{
    const headers={Authorization:"Bearer "+tmdbToken,Accept:"application/json"};
    let movieId=movie.tmdbId;
    if(!movieId){
      const query=new URLSearchParams({query:movie.title,include_adult:"true"});
      if(movie.year)query.set("year",String(movie.year));
      const response=await fetch("https://api.themoviedb.org/3/search/movie?"+query,{headers});
      if(!response.ok)throw new Error("TMDB search failed: "+response.status);
      const results=(await response.json()).results||[];if(!results.length)throw new Error("No title match");
      const match=results.find(r=>!movie.year||!r.release_date||Number(r.release_date.slice(0,4))===Number(movie.year))||results[0];
      movieId=match.id;movie.tmdbId=movieId;
      if(match.poster_path&&!movie.posterUrl){movie.posterUrl="https://image.tmdb.org/t/p/w500"+match.poster_path;refreshTapeCatalogue();}
    }
    const details=await fetch("https://api.themoviedb.org/3/movie/"+movieId+"?append_to_response=credits",{headers});
    if(!details.ok)throw new Error("TMDB details failed: "+details.status);
    const d=await details.json();movie.tmdbId=d.id;movie.year=d.release_date?Number(d.release_date.slice(0,4)):movie.year;
    movie.genre=(d.genres||[]).map(g=>g.name).join(" / ")||movie.genre;movie.runtime=d.runtime?d.runtime+" MIN":movie.runtime;
    movie.synopsis=d.overview||movie.synopsis;movie.director=(d.credits?.crew||[]).find(p=>p.job==="Director")?.name||movie.director;
    movie.cast=(d.credits?.cast||[]).slice(0,4).map(p=>p.name).join(" · ")||movie.cast;
    movie.posterUrl=d.poster_path?"https://image.tmdb.org/t/p/w500"+d.poster_path:movie.posterUrl||"";
    movie.posterLookupDone=true;movie.tmdbLoaded=true;
    saveImportedMovies();refreshGenreFilter();refreshTapeCatalogue();
  }catch(error){console.warn("TMDB metadata:",error);$("tmdb-status").textContent="TMDB lookup failed for "+movie.title+". Check your token.";}
  finally{movie.tmdbLoading=false;}
}
function renderFilmMetadata(movie){
  $("film-year").textContent=String(movie.year||"—");$("film-genre").textContent=(movie.genre||"FEATURE PRESENTATION").toUpperCase();
  $("film-runtime").textContent=movie.runtime||"— MIN";$("film-rating").textContent=movie.rating||"NR";
  $("film-director").textContent=movie.director||"";$("film-cast").textContent=movie.cast||"";$("film-synopsis").textContent=movie.synopsis||"";
  $("film-back-title").textContent=(movie.title||"").toUpperCase()+" / "+(movie.year||"");$("film-back-synopsis").textContent=movie.synopsis||"";
  if(movie.posterUrl){const img=$("film-art").querySelector("img");if(img)img.src=movie.posterUrl;}
  const reverse=$("film-art").querySelector(".film-art-back");
  if(reverse){
    const title=reverse.querySelector("strong"),synopsis=reverse.querySelector("p"),director=reverse.querySelector("small");
    if(title)title.textContent=(movie.title||"UNTITLED").toUpperCase()+" · "+(movie.year||"—");
    if(synopsis)synopsis.textContent=movie.synopsis||"PLEASE ASK THE CLERK FOR MORE INFORMATION.";
    if(director)director.textContent="DIRECTED BY "+(movie.director||"UNKNOWN");
  }
}

function bindEvents() {
  $("play-toggle").addEventListener("click",()=>{toggleAudio();$("play-toggle").querySelector("span:last-child").textContent=$("sound-toggle").getAttribute("aria-pressed")==="true"?"PAUSE":"PLAY";});
  $("resume-store").addEventListener("click",()=>{clearMovementInput(true);paused=false;$("pause-screen").hidden=true;requestLock();});
  $("film-close").addEventListener("click",closePanels);
  $("library-close").addEventListener("click",closePanels);
  $("flip-film").addEventListener("click",flipFilm);
  $("flip-back").addEventListener("click",()=>{flipFilm();});
  $("survival-toggle").addEventListener("click",()=>setSurvival(!survivalMode));
  $("vr-toggle").addEventListener("click",enterVR);
  $("sound-toggle").addEventListener("click",toggleAudio);
  $("movie-search").addEventListener("input",e=>renderMovieList(e.target.value));
  $("genre-filter").addEventListener("change",()=>renderMovieList($("movie-search").value));
  $("library-sort").addEventListener("change",()=>renderMovieList($("movie-search").value));
  $("import-library").addEventListener("click",()=>$("library-file").click());
  $("library-file").addEventListener("change",importLetterboxdFiles);
  $("tmdb-token").value=tmdbToken;$("save-tmdb").addEventListener("click",saveTMDBToken);
  $("help-toggle").addEventListener("click",()=>{const card=$("help-card");card.hidden=!card.hidden;$("help-toggle").setAttribute("aria-expanded",String(!card.hidden));});
  document.addEventListener("pointerlockchange",onPointerLockChange);
  canvas.addEventListener("pointerdown",e=>{
    if(e.pointerType==="touch"||e.button!==0||!started||paused||!$("film-panel").hidden||!$("library-panel").hidden)return;
    suppressCanvasClick=false;pointerDragging=true;pointerDragMoved=false;pointerLastX=e.clientX;pointerLastY=e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  const stopPointerDrag=e=>{
    if(!pointerDragging)return;
    pointerDragging=false;
    if(pointerDragMoved)suppressCanvasClick=true;
  };
  canvas.addEventListener("pointerup",stopPointerDrag);
  canvas.addEventListener("pointercancel",stopPointerDrag);
  document.addEventListener("mousemove",e=>{
    if(paused||!$("film-panel").hidden||!$("library-panel").hidden)return;
    if(isLocked){yaw-=e.movementX*.00215;pitch-=e.movementY*.00215;}
    else if(pointerDragging){
      const dx=e.clientX-pointerLastX,dy=e.clientY-pointerLastY;
      if(Math.abs(dx)+Math.abs(dy)>2)pointerDragMoved=true;
      yaw-=dx*.0042;pitch-=dy*.0042;
      pointerLastX=e.clientX;pointerLastY=e.clientY;
    }
    pitch=THREE.MathUtils.clamp(pitch,-1.22,1.22);updateCamera();
  });
  const movementAliases={
    moveForward:new Set(["z","w","arrowup"]),
    moveLeft:new Set(["q","a","arrowleft"]),
    moveBack:new Set(["s","arrowdown"]),
    moveRight:new Set(["d","arrowright"])
  };
  const isInteractiveTarget=target=>target instanceof Element&&!!target.closest("input,textarea,select,button,[role='button'],[contenteditable='true']");
  const updateMovementKey=(event,pressed)=>{
    const key=String(event.key||"").toLowerCase();
    for(const [state,aliases] of Object.entries(movementAliases)){
      if(aliases.has(key)){keys[state]=pressed;return true;}
    }
    return false;
  };
  document.addEventListener("keydown",e=>{
    if(isInteractiveTarget(e.target)&&e.code!=="Escape")return;
    if(isInterfacePanelOpen()&&e.code!=="Escape")return;
    if(paused&&!["Escape","Enter"].includes(e.code))return;
    const movementKey=updateMovementKey(e,true);
    if(e.code==="Space")keys.Space=true;
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")running=true;
    if(movementKey||["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
    if(e.repeat)return;
    if(e.code==="KeyE"&&started)interact();
    if(e.code==="KeyF"&&started)setFlashlight(!flashlightOn);
    if(e.code==="KeyC"&&started){crouching=!crouching;showToast(crouching?"CROUCH":"STANDING");}
    if(e.code==="KeyM"&&started){if($("library-panel").hidden)openLibrary();else closePanels();}
    if(e.code==="KeyR"&&started)setSurvival(!survivalMode);
    if(e.code==="KeyV"&&started)enterVR();
    if(e.code==="KeyH"&&started){const card=$("help-card");card.hidden=!card.hidden;$("help-toggle").setAttribute("aria-expanded",String(!card.hidden));}
    if(e.code==="Escape"&&started){
      if(!$("film-panel").hidden||!$("library-panel").hidden)closePanels();
      else if(!paused){clearMovementInput(true);paused=true;document.exitPointerLock?.();$("pause-screen").hidden=false;}
      else{paused=false;$("pause-screen").hidden=true;requestLock();}
    }
    if(e.code==="Enter"&&paused){clearMovementInput(true);paused=false;requestLock();}
  });
  document.addEventListener("keyup",e=>{
    updateMovementKey(e,false);
    if(e.code==="Space")keys.Space=false;
    if(e.code==="ShiftLeft"||e.code==="ShiftRight")running=false;
  });
  window.addEventListener("blur",()=>clearMovementInput(true));
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clearMovementInput(true);});
  canvas.addEventListener("click",()=>{
    if(suppressCanvasClick){suppressCanvasClick=false;return;}
    if(started&&!paused&&$("film-panel").hidden&&$("library-panel").hidden)interact();
  });
  canvas.addEventListener("wheel",e=>{
    if(!started||paused||!$("film-panel").hidden||!$("library-panel").hidden)return;
    e.preventDefault();const step=THREE.MathUtils.clamp(Math.abs(e.deltaY)*.004,0,.9)*Math.sign(e.deltaY);
    tempForward.set(-Math.sin(yaw),0,-Math.cos(yaw));player.position.addScaledVector(tempForward,step);
    player.position.x=THREE.MathUtils.clamp(player.position.x,-3.75,3.75);
    updateWorldStreaming();updateCamera();
  },{passive:false});
  // Mobile controls hold movement keys; touch-drag rotates the camera.
  document.querySelectorAll("[data-move]").forEach(button=>{
    const moveMap={forward:"moveForward",back:"moveBack",left:"moveLeft",right:"moveRight"};
    const key=moveMap[button.dataset.move];
    button.addEventListener("pointerdown",e=>{e.preventDefault();keys[key]=true;button.setPointerCapture(e.pointerId);});
    ["pointerup","pointercancel","lostpointercapture"].forEach(event=>button.addEventListener(event,()=>keys[key]=false));
  });
  $("mobile-run").addEventListener("pointerdown",e=>{e.preventDefault();running=true;});
  ["pointerup","pointercancel","pointerleave","lostpointercapture"].forEach(e=>$("mobile-run").addEventListener(e,()=>running=false));
  $("mobile-jump").addEventListener("pointerdown",e=>{e.preventDefault();if(grounded)keys.Space=true;});
  $("mobile-crouch").addEventListener("click",()=>{
    crouching=!crouching;$("mobile-crouch").textContent=crouching?"STAND":"CROUCH";
    showToast(crouching?"CROUCH":"STANDING");
  });
  $("mobile-flashlight").addEventListener("click",()=>setFlashlight(!flashlightOn));
  $("mobile-examine").addEventListener("click",interact);
  let touchX=0,touchY=0;
  canvas.addEventListener("touchstart",e=>{if(!started)return;touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;},{passive:true});
  canvas.addEventListener("touchmove",e=>{
    if(!started || isLocked || $("film-panel").hidden===false || $("library-panel").hidden===false)return;
    const t=e.touches[0],dx=t.clientX-touchX,dy=t.clientY-touchY;touchX=t.clientX;touchY=t.clientY;
    yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.22,1.22);updateCamera();
  },{passive:true});
  window.addEventListener("resize",updateResize);
}

async function init() {
  try {
    clock=new THREE.Clock();
    // Create shared case geometries/materials before populating the store.
    if(!window.WebGL2RenderingContext) throw new Error("WebGL 2 is not available.");
    createWorld();
    bindEvents();
    initialized=true;progress.style.width="100%";$("boot-status").textContent="OPEN 24 HOURS. ALWAYS.";
    restoreImportedMovies();animate();setTimeout(enterStore,650);
  } catch(error) {
    console.error(error);
    boot.hidden=true;
    fallback.hidden=false;
    $("boot-error").hidden=false;
    $("boot-error").textContent=error.message||"Could not start the 3D experience.";
  }
}

// Quiet studio-mark loading screen, as in the reference.
progress.style.width="12%";
const bootMessages=["REWINDING TAPES","STOCKING SHELVES","ADJUSTING TRACKING","CLEANING THE HEADS","SORTING THE RETURNS","DUSTING THE COVERS","WARMING UP THE TUBES","CHECKING LATE FEES","SWITCHING ON THE NEON","MOPPING AISLE 7","DEGAUSSING THE SCREENS","COUNTING THE TILL","STAMPING THE DUE DATES","PATCHING SNAPPED TAPE","RELABELING THE SPINES","PEELING OFF PRICE TAGS","RESTOCKING THE POPCORN","SETTING THE VCR CLOCK","UNTANGLING THE CABLES","REPLACING THE FLUORESCENTS","FIXING THE FLICKERING SIGN","FINDING THE REMOTE","RESHELVING HORROR","WAKING THE NIGHT SHIFT","LOCKING THE BACK ROOM"];
let bootMessageIndex=0;setInterval(()=>{if($("boot-status"))$("boot-status").textContent=bootMessages[bootMessageIndex++%bootMessages.length];},520);
setTimeout(()=>{progress.style.width="38%";},180);setTimeout(()=>{progress.style.width="64%";},420);init();