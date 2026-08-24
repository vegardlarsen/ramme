// Design reference — exported from Claude Design project
// https://claude.ai/design/p/0a01df23-853a-48cf-8724-8c437a1a4e71?file=Ambient+Animasjon.dc.html
// This is the animated mockup ("Ambient Animasjon"). The mockup animates a
// fake day on a timeline (pDag/pKveld/pRet are scene cues); the real app
// derives the same weights from the actual clock. Port the SKY table,
// skyAt(), color tables, and all layout/typography values verbatim.

const {CompositionStage, useComposition, animate, Easing} = window;
const EASE = Easing.easeInOutCubic;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
const rgba4 = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
const pad2 = (n) => String(n).padStart(2, '0');

const Icon = ({d, size, style}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" style={style}>{d}</svg>
);
const D_SUN = [<circle key="c" cx="12" cy="12" r="4"/>, <path key="p" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>];
const D_CLOUDSUN = [<path key="p" d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>];
const D_CLOUD = [<path key="p" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>];
const D_MOON = [<path key="p" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>];

const HourItem = ({t, d, temp}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
    <span style={{fontSize: 21, opacity: 0.6}}>{t}</span>
    <Icon d={d} size={32}/>
    <span style={{fontSize: 25, fontWeight: 600}}>{temp}</span>
  </div>
);

// Himmelmodell: bakgrunnen beregnes kontinuerlig fra klokkeslettet (hVal) i stedet
// for kryssfading mellom tre faste gradienter — og dempes av skydekket fra værmeldingen.
const SKY = [
  [4.5,  [26, 32, 64],   [16, 20, 36],   [30, 20, 42]],   // natt
  [6.2,  [120, 110, 160],[255, 200, 160],[210, 195, 210]], // soloppgang 06:12
  [7.25, [255, 217, 188],[255, 243, 228],[207, 228, 242]], // morgen
  [11.0, [221, 240, 251],[253, 254, 255],[244, 250, 254]], // formiddag
  [16.0, [200, 228, 246],[250, 250, 248],[255, 240, 222]], // ettermiddag
  [19.6, [150, 160, 200],[255, 190, 150],[240, 172, 140]], // mot solnedgang 21:02
  [21.2, [70, 84, 130],  [58, 58, 98],   [88, 58, 88]],    // skumring
  [22.5, [38, 48, 79],   [20, 24, 40],   [36, 22, 41]],    // kveld
  [28.5, [26, 32, 64],   [16, 20, 36],   [30, 20, 42]],    // natt (wrap)
];
const GREY = [205, 208, 212];
function skyAt(h, cloud) {
  const x = h < SKY[0][0] ? h + 24 : h;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (x >= SKY[i][0] && x <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const t = (x - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map((i) => mix(mix(a[i], b[i], t), GREY, cloud * 0.45));
}

const TXT_M = [58, 42, 32], TXT_D = [23, 52, 69], TXT_K = [241, 236, 250];
const PAN_M = [255, 255, 255, 0.5], PAN_D = [23, 52, 69, 0.06], PAN_K = [255, 255, 255, 0.08];
const PHOTO = 'https://images.unsplash.com/photo-1742458500183-7c5dd1ecd9eb?q=75&w=1200&auto=format&fit=crop';

function Piece() {
  const {T, CUES} = useComposition();
  const pDag = animate({from: 0, to: 1, start: CUES.Dag - 1.2, end: CUES.Dag + 1.0, ease: EASE})(T);
  const pKveld = animate({from: 0, to: 1, start: CUES.Kveld - 1.2, end: CUES.Kveld + 1.0, ease: EASE})(T);
  const RET = CUES['Neste morgen'];
  const pRet = animate({from: 0, to: 1, start: RET - 0.4, end: RET + 1.3, ease: EASE})(T);

  const txt = rgb(mix(mix(mix(TXT_M, TXT_D, pDag), TXT_K, pKveld), TXT_M, pRet));
  const pan = rgba4(mix(mix(mix(PAN_M, PAN_D, pDag), PAN_K, pKveld), PAN_M, pRet));

  const hVal = (7.25 + 6.25 * pDag + 7.25 * pKveld + 10.5 * pRet) % 24;
  const hh = pad2(Math.floor(hVal)), mm = pad2(Math.floor((hVal % 1) * 60));
  const temp = Math.round(12 + 5 * pDag - 4 * pKveld - 1 * pRet);

  // Skydekke fra timevarselet: lettskyet morgen -> sol -> klar kveld
  const cloud = 0.35 * (1 - pDag) * (1 - pKveld) + 0.35 * pRet;
  const [s1, s2, s3] = skyAt(hVal, cloud);

  const oM = Math.max(1 - pDag, pRet);      // morgen-innhold
  const oP = pDag * (1 - pKveld);           // dag/foto
  const oT = pKveld * (1 - pRet);           // kveld/avfall
  const rise = (o) => `translateY(${(1 - o) * 36}px)`;
  const layer = (o) => ({position: 'absolute', inset: 0, opacity: o, transform: rise(o), pointerEvents: 'none'});

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: "'Outfit',sans-serif", color: txt, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(172deg, ${rgb(s1)} 0%, ${rgb(s2)} 52%, ${rgb(s3)} 100%)`}}/>

      <div style={{position: 'absolute', inset: 0, padding: 72, display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <div style={{fontSize: 175, fontWeight: 300, lineHeight: 0.95, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums'}}>{hh}:{mm}</div>
            <div style={{fontSize: 30, marginTop: 16, opacity: 0.75, position: 'relative', height: 40}}>
              <span style={{position: 'absolute', opacity: 1 - pRet}}>Fredag 22. august · 21,5° inne</span>
              <span style={{position: 'absolute', opacity: pRet}}>Lørdag 23. august · 21,2° inne</span>
            </div>
          </div>
          <div style={{background: pan, borderRadius: 36, padding: '30px 38px', textAlign: 'center', minWidth: 210}}>
            <div style={{position: 'relative', height: 58}}>
              <Icon d={D_CLOUDSUN} size={58} style={{position: 'absolute', left: '50%', marginLeft: -29, opacity: oM}}/>
              <Icon d={D_SUN} size={58} style={{position: 'absolute', left: '50%', marginLeft: -29, opacity: oP}}/>
              <Icon d={D_MOON} size={58} style={{position: 'absolute', left: '50%', marginLeft: -29, opacity: oT}}/>
            </div>
            <div style={{fontSize: 50, fontWeight: 600, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>{temp}°</div>
            <div style={{fontSize: 22, opacity: 0.7, position: 'relative', height: 30}}>
              <span style={{position: 'absolute', left: 0, right: 0, opacity: oM}}>lettskyet · ↑ 06:12</span>
              <span style={{position: 'absolute', left: 0, right: 0, opacity: oP}}>sol · 0 mm</span>
              <span style={{position: 'absolute', left: 0, right: 0, opacity: oT}}>klart · ↓ 21:02</span>
            </div>
          </div>
        </div>

        <div style={{background: pan, borderRadius: 32, padding: '26px 40px', marginTop: 40, position: 'relative', height: 150, boxSizing: 'border-box'}}>
          <div style={{position: 'absolute', inset: '26px 40px', display: 'flex', justifyContent: 'space-between', opacity: oM}}>
            <HourItem t="08" d={D_CLOUDSUN} temp="12°"/><HourItem t="10" d={D_SUN} temp="14°"/><HourItem t="12" d={D_SUN} temp="16°"/>
            <HourItem t="14" d={D_SUN} temp="17°"/><HourItem t="16" d={D_CLOUDSUN} temp="16°"/><HourItem t="18" d={D_CLOUD} temp="15°"/>
          </div>
          <div style={{position: 'absolute', inset: '26px 40px', display: 'flex', justifyContent: 'space-between', opacity: oP}}>
            <HourItem t="14" d={D_SUN} temp="17°"/><HourItem t="15" d={D_SUN} temp="17°"/><HourItem t="16" d={D_CLOUDSUN} temp="16°"/>
            <HourItem t="18" d={D_CLOUD} temp="15°"/><HourItem t="20" d={D_CLOUD} temp="13°"/><HourItem t="22" d={D_MOON} temp="12°"/>
          </div>
          <div style={{position: 'absolute', inset: '26px 40px', display: 'flex', justifyContent: 'space-between', opacity: oT}}>
            <HourItem t="21" d={D_MOON} temp="13°"/><HourItem t="22" d={D_MOON} temp="12°"/><HourItem t="23" d={D_MOON} temp="11°"/>
            <HourItem t="01" d={D_MOON} temp="10°"/><HourItem t="03" d={D_MOON} temp="9°"/><HourItem t="i mrg" d={D_SUN} temp="18°"/>
          </div>
        </div>

        <div style={{flex: 1, position: 'relative', marginTop: 40}}>
          <div style={layer(oM)}>
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <div style={{background: 'rgba(255,255,255,0.7)', borderRadius: 44, padding: 64, color: '#3A2A20'}}>
                <div style={{fontSize: 24, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: '#C4572E'}}>Før 08:00</div>
                <div style={{fontSize: 96, fontWeight: 700, lineHeight: 1.05, marginTop: 14}}>Gymtøy på skolen</div>
                <div style={{fontSize: 30, marginTop: 14, opacity: 0.7}}>Louise · kroppsøving 3. time</div>
              </div>
            </div>
          </div>
          <div style={{...layer(oP), transform: `${rise(oP)} scale(${1.03 - 0.03 * oP})`}}>
            <img src={PHOTO} alt="" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 44}}/>
            <div style={{position: 'absolute', left: 36, bottom: 30, fontSize: 20, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 8px rgba(0,0,0,0.5)'}}>
              Fra bildearkivet · Foto: Lawrence Krowdeed / Unsplash
            </div>
          </div>
          <div style={layer(oT)}>
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <div style={{background: 'rgba(255,184,107,0.14)', border: '1.5px solid rgba(255,184,107,0.35)', borderRadius: 44, padding: 64, color: '#F1ECFA'}}>
                <div style={{fontSize: 24, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: '#FFB86B'}}>I kveld</div>
                <div style={{fontSize: 96, fontWeight: 700, lineHeight: 1.05, marginTop: 14}}>Sett ut papirdunken</div>
                <div style={{fontSize: 30, marginTop: 14, opacity: 0.7}}>Papiravfall hentes i morgen tidlig</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{position: 'relative', height: 170, marginTop: 36}}>
          <div style={{...layer(oM), display: 'flex', gap: 18}}>
            <div style={{flex: 1, background: pan, borderRadius: 28, padding: '24px 28px'}}><div style={{fontSize: 24, fontWeight: 700}}>Vegard</div><div style={{fontSize: 23, opacity: 0.75, marginTop: 8}}>09:00 Statusmøte</div></div>
            <div style={{flex: 1, background: pan, borderRadius: 28, padding: '24px 28px'}}><div style={{fontSize: 24, fontWeight: 700}}>Anne C.</div><div style={{fontSize: 23, opacity: 0.75, marginTop: 8}}>11:30 Tannlege</div></div>
            <div style={{flex: 1, background: pan, borderRadius: 28, padding: '24px 28px'}}><div style={{fontSize: 24, fontWeight: 700}}>Louise</div><div style={{fontSize: 23, opacity: 0.75, marginTop: 8}}>14:30 Fotball</div></div>
            <div style={{flex: 1, background: pan, borderRadius: 28, padding: '24px 28px'}}><div style={{fontSize: 24, fontWeight: 700}}>Elisabeth</div><div style={{fontSize: 23, opacity: 0.75, marginTop: 8}}>13:00 Svømming</div></div>
          </div>
          <div style={{...layer(oP), display: 'flex', gap: 18, alignItems: 'flex-start'}}>
            <div style={{background: pan, borderRadius: 28, padding: '26px 32px', fontSize: 27}}><b>14:30</b> Fotball · Louise</div>
            <div style={{background: pan, borderRadius: 28, padding: '26px 32px', fontSize: 27}}><b>16:30</b> Henting · Vegard</div>
            <div style={{background: pan, borderRadius: 28, padding: '26px 32px', fontSize: 27}}><b>17:30</b> Yoga · Anne C.</div>
          </div>
          <div style={{...layer(oT), display: 'flex', alignItems: 'flex-start'}}>
            <div style={{background: pan, borderRadius: 28, padding: '30px 38px', fontSize: 27, opacity: 0.9, width: '100%', boxSizing: 'border-box'}}>
              I morgen: <b>Louise bursdag hos Emma 12:00</b> · pent vær, 18°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AmbientApp = function AmbientApp() {
  return (
    <CompositionStage width={1080} height={1920} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#141828">
      <Piece/>
    </CompositionStage>
  );
};
