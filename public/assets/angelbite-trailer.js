(()=>{
  'use strict';

  const $=s=>document.querySelector(s);
  const stage=$('#trailer'),frame=$('#site-frame'),opening=$('#opening'),assistant=$('#assistant');
  const message=$('#speech-text'),chapterName=$('#chapter-name'),chapterCount=$('#chapter-count'),progress=$('#progress-fill');
  const accountPreview=$('#account-preview'),flash=$('#scene-flash'),flashName=$('#flash-name');
  const controls=$('#controls'),pauseButton=$('#pause-button'),soundButton=$('#sound-button'),skipButton=$('#skip-button');
  const ending=$('#ending'),blackout=$('#blackout'),srStatus=$('#sr-status');
  const originalPrefs=new Map();
  const temporaryPrefs=['abTeaserSeen','abTeaserCardClosed','abGuideSeen'];
  let runId=0,paused=false,started=false,finished=false,soundOn=true,frameReady=false,audioContext=null,activePanelId='home';
  const pauseWaiters=[];

  function safeGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
  function safeSet(key,value){try{localStorage.setItem(key,value)}catch(e){}}
  function installPreviewPrefs(){
    temporaryPrefs.forEach(key=>{originalPrefs.set(key,safeGet(key));safeSet(key,'1')});
    soundOn=safeGet('abSounds')!=='0';
    paintSound();
  }
  function restorePreviewPrefs(){
    temporaryPrefs.forEach(key=>{const value=originalPrefs.get(key);if(value===null)safeRemove(key);else safeSet(key,value)});
  }
  function safeRemove(key){try{localStorage.removeItem(key)}catch(e){}}
  addEventListener('pagehide',restorePreviewPrefs,{once:true});

  function buildBrand(){
    const el=document.createElement('div');el.className='brand-assembly';el.id='brand-assembly';el.setAttribute('aria-label','AngelBite');el.setAttribute('aria-hidden','true');
    [...'ANGELBITE'].forEach((char,i)=>{const span=document.createElement('span');span.className='brand-letter';span.textContent=char;span.style.animationDelay=`${.1+i*.095}s`;span.style.setProperty('--x',`${((i%3)-1)*32}px`);span.style.setProperty('--r',`${i%2?14:-14}deg`);el.append(span)});
    opening.append(el);
  }

  function decorateFrame(){
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.head||!doc.body)return;
      let style=doc.getElementById('angelbite-trailer-mode');
      if(!style){
        style=doc.createElement('style');style.id='angelbite-trailer-mode';
        style.textContent=`
          html,body{height:100%!important;overflow:hidden!important;scroll-behavior:auto!important}
          body{min-height:100%!important}
          #loader,#nav,#dots,#fab,#menu,#top,#ab-pop,#guide,#site-help,#foot,footer,#sp{display:none!important}
          #home.panel-hidden,body>section.panel-hidden{display:none!important}
          #home:not(.panel-hidden),body>section:not(.panel-hidden){position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-height:100%!important;max-width:none!important;margin:0!important;padding:76px clamp(24px,7vw,116px) 176px!important;overflow:auto!important;scrollbar-width:none!important}
          #home:not(.panel-hidden)::-webkit-scrollbar,body>section:not(.panel-hidden)::-webkit-scrollbar{display:none!important}
          #home:not(.panel-hidden)>.hero{min-height:calc(100vh - 250px)!important;padding-top:62px!important;padding-bottom:22px!important}
          #home .rv,body>section .rv{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}
          .trailer-panel-leave{opacity:0!important;transform:translate3d(-14px,0,0) scale(.995)!important;filter:none!important;transition:opacity .16s ease,transform .16s ease!important}
          .trailer-panel-enter{animation:ab-trailer-panel-in .56s both cubic-bezier(.18,.78,.2,1)}
          @keyframes ab-trailer-panel-in{0%{opacity:0;transform:translate3d(18px,0,0) scale(.992)}68%{opacity:1;transform:translate3d(-2px,0,0) scale(1.002)}100%{opacity:1;transform:none}}
          @media(max-width:700px){#home:not(.panel-hidden),body>section:not(.panel-hidden){padding:62px 18px 190px!important}#home:not(.panel-hidden)>.hero{min-height:calc(100svh - 210px)!important;padding-top:55px!important}}
        `;
        doc.head.append(style);
      }
      doc.documentElement.classList.add('ab-trailer-mode');
      doc.getElementById('ab-loader-skip')?.click();
      frameReady=true;
    }catch(e){frameReady=false}
  }

  let resolveFrame;
  const framePromise=new Promise(resolve=>{resolveFrame=resolve});
  frame.addEventListener('load',()=>{decorateFrame();resolveFrame(true)},{once:true});
  installPreviewPrefs();
  buildBrand();
  frame.src='index.html#home';

  const scenes=[
    {id:'home',name:'ГЛАВНАЯ',position:'bottom-left',text:'На главной — коротко о AngelBite, ближайшем вайпе и быстрый переход к заявке.'},
    {id:'about',name:'О ХАУСЕ',position:'top-right',text:'AngelBite — мирный Minecraft-хаус для совместной игры, строительства и общения без гриферства.'},
    {id:'world',name:'МИР ANGELBITE',position:'bottom-right',text:'В разделе «Мир» — атмосфера хауса, большие постройки и идеи для совместных приключений.'},
    {id:'gallery',name:'ГАЛЕРЕЯ',position:'top-left',text:'Галерея собирает кадры из мира: ночные прогулки, фонари и уютные постройки.'},
    {id:'updates',name:'ОБНОВЛЕНИЯ',position:'bottom-right',text:'Здесь появляются новости проекта и объявления администрации — всё важное в одном месте.'},
    {id:'server',name:'СЕРВЕР',position:'top-left',text:'Тут собраны версия Java, порядок вступления и дата вайпа. Адрес доступен только участникам.'},
    {id:'rules',name:'ПРАВИЛА',position:'top-right',text:'Правила разделены по категориям, а поиск помогает быстро найти нужный пункт.'},
    {id:'addons',name:'ДОПОЛНЕНИЯ',position:'bottom-left',text:'В дополнениях — моды и ресурс-паки для версии сервера и подходящего загрузчика.'},
    {id:'home',name:'АККАУНТ ANGELBITE',position:'top-left',preview:true,text:'В аккаунте можно оформить профиль, открыть сундук дня и выбрать стикеры. Рубины пока начисляет администрация.'},
    {id:'join',name:'ВСТУПЛЕНИЕ',position:'bottom-right',text:'Чтобы присоединиться, отправь анкету через Telegram. Аккаунт сайта сам по себе не открывает доступ к серверу.'}
  ];

  function paintSound(){
    if(!soundButton)return;
    soundButton.setAttribute('aria-pressed',String(soundOn));
    soundButton.setAttribute('aria-label',soundOn?'Отключить звуковые эффекты':'Включить звуковые эффекты');
    soundButton.innerHTML=soundOn?'♫ <span>Эффекты включены</span>':'♪ <span>Эффекты выключены</span>';
  }
  function paintPause(){
    pauseButton.innerHTML=paused?'▶ <span>Продолжить</span>':'Ⅱ <span>Пауза</span>';
    pauseButton.setAttribute('aria-label',paused?'Продолжить трейлер':'Пауза');
  }
  function delay(ms,token){
    return new Promise(resolve=>{
      let remaining=ms,last=performance.now();
      const tick=()=>{
        if(token!==runId){resolve(false);return}
        if(paused){last=performance.now();pauseWaiters.push(()=>{last=performance.now();tick()});return}
        const now=performance.now();remaining-=now-last;last=now;
        if(remaining<=0){resolve(true);return}
        setTimeout(tick,Math.min(80,remaining));
      };
      setTimeout(tick,Math.min(80,ms));
    });
  }
  function setPaused(value){
    if(paused===value)return;paused=value;paintPause();
    if(!value)while(pauseWaiters.length)pauseWaiters.shift()();
  }
  function tone(kind='soft'){
    if(!soundOn)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      audioContext=audioContext||new Audio();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const osc=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(kind==='land'?640:kind==='shift'?420:520,now);
      if(kind==='land')osc.frequency.exponentialRampToValueAtTime(310,now+.18);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='land'?.045:.025,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='land'?.24:.16));
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+(kind==='land'?.25:.17));
    }catch(e){}
  }
  function typeText(text,token){
    message.textContent='';
    let index=0;
    return new Promise(async resolve=>{
      while(index<text.length&&token===runId){
        if(paused){await new Promise(r=>pauseWaiters.push(r));continue}
        message.textContent+=text[index++];
        const char=text[index-1];await delay(/[,.!?—;]/.test(char)?54:22,token);
      }
      resolve(token===runId);
    });
  }
  async function tell(text,token,position='bottom-left'){
    assistant.dataset.position=position;assistant.classList.remove('done');
    assistant.hidden=false;assistant.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>assistant.classList.add('visible'));
    await delay(300,token);if(token!==runId)return false;
    tone('soft');
    const readingTime=Math.min(5400,Math.max(2900,text.length*42));
    const ok=await Promise.all([typeText(text,token),delay(readingTime,token)]);
    if(!ok.every(Boolean)||token!==runId)return false;
    assistant.classList.add('done');
    return delay(520,token);
  }
  async function hideAssistant(token){
    assistant.classList.remove('visible','done');accountPreview.classList.remove('visible');accountPreview.setAttribute('aria-hidden','true');
    await delay(430,token);if(token===runId){assistant.hidden=true;assistant.setAttribute('aria-hidden','true')}
  }
  async function showTransition(label,token){
    flashName.textContent=label;flash.classList.add('visible');tone('shift');
    stage.classList.remove('scene-in');stage.classList.add('scene-out');
    return delay(155,token);
  }
  async function navigate(id,token){
    if(!frameReady)decorateFrame();
    let doc,target,current;
    try{
      doc=frame.contentDocument;target=doc&&doc.getElementById(id);
      const panels=doc&&[doc.getElementById('home'),...doc.querySelectorAll('body>section')].filter(Boolean);
      current=panels&&panels.find(panel=>!panel.classList.contains('panel-hidden'));
      if(!target)return false;
      if(current!==target){
        if(current){current.classList.add('trailer-panel-leave');await delay(160,token);if(token!==runId)return false;current.classList.add('panel-hidden');current.classList.remove('trailer-panel-leave');current.setAttribute('aria-hidden','true')}
        target.classList.remove('panel-hidden');target.setAttribute('aria-hidden','false');target.classList.add('trailer-panel-enter');
        setTimeout(()=>target.classList.remove('trailer-panel-enter'),620);
        activePanelId=id;
        try{frame.contentWindow.history.replaceState(null,'','#'+id)}catch(e){}
      }else activePanelId=id;
    }catch(e){return false}
    stage.classList.remove('scene-out','scene-in');void frame.offsetWidth;stage.classList.add('scene-in');
    await delay(640,token);
    flash.classList.remove('visible');
    setTimeout(()=>stage.classList.remove('scene-in'),720);
    return token===runId;
  }
  function setChapter(index,label){
    chapterCount.textContent=`${String(Math.min(index+1,scenes.length)).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}`;
    chapterName.textContent=label;progress.style.width=`${Math.min(100,((index+1)/scenes.length)*100)}%`;
  }
  async function playTour(token){
    const ready=await Promise.race([framePromise,new Promise(r=>setTimeout(()=>r(false),12000))]);
    if(token!==runId)return;
    if(!ready){decorateFrame();frameReady=true}
    if(!stage.classList.contains('is-playing'))stage.classList.add('is-playing');
    await delay(1650,token);
    stage.classList.add('revealed');opening.setAttribute('aria-hidden','true');
    frame.setAttribute('aria-hidden','false');
    for(let i=0;i<scenes.length;i++){
      if(token!==runId)return;
      const scene=scenes[i];setChapter(i,scene.name);
      if(i>0){
        const transition=await showTransition(scene.name,token);if(!transition)return;
        if(!await navigate(scene.id,token))return;
      }else if(!await delay(520,token))return;
      if(scene.preview){accountPreview.classList.add('visible');accountPreview.setAttribute('aria-hidden','false')}
      if(!await tell(scene.text,token,scene.position))return;
      await hideAssistant(token);
      if(!await delay(250,token))return;
    }
    startFinale();
  }
  function openTrailer(){
    if(started)return;started=true;stage.dataset.state='playing';stage.classList.add('started');controls.hidden=false;
    $('#start-button').disabled=true;pauseButton.focus({preventScroll:true});tone('land');
    if(audioContext&&audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const token=++runId;playTour(token);
  }
  function prepareEndingText(){
    ending.querySelectorAll('[data-copy]').forEach((line,lineIndex)=>{
      const text=line.getAttribute('data-copy');line.replaceChildren();
      [...text].forEach((char,i)=>{
        if(char===' '){const space=document.createElement('span');space.className='ending-char space';space.textContent='\u00a0';space.style.setProperty('--dx','0px');space.style.setProperty('--dy','0px');space.style.setProperty('--dr','0deg');space.style.setProperty('--delay',`${(i*15+lineIndex*150)/1000}s`);line.append(space);return}
        const span=document.createElement('span');span.className='ending-char';span.textContent=char;
        const seed=(i*37+text.length*19+lineIndex*13)%53;
        span.style.setProperty('--dx',`${((seed%2?1:-1)*(18+(seed*7)%68))}px`);
        span.style.setProperty('--dy',`${((seed%3?1:-1)*(16+(seed*5)%62))}px`);
        span.style.setProperty('--dr',`${((seed%2?1:-1)*(2+(seed*3)%7))}deg`);
        span.style.setProperty('--delay',`${(i*15+lineIndex*150)/1000}s`);line.append(span);
      });
    });
  }
  async function startFinale(){
    const token=++runId;setPaused(false);
    stage.dataset.state='ending';setChapter(scenes.length,'ЗАКЛЮЧЕНИЕ');progress.style.width='100%';controls.hidden=true;
    if(!await showTransition('ГЛАВНАЯ',token))return;
    await navigate('home',token);if(token!==runId)return;
    const closing='Благодарю за ваше внимание и всего вам хорошего.';
    const said=await tell(closing,token,'top-right');if(!said||token!==runId)return;
    await hideAssistant(token);if(token!==runId)return;
    frame.setAttribute('aria-hidden','true');
    stage.classList.add('is-ending');prepareEndingText();ending.hidden=false;
    requestAnimationFrame(()=>ending.classList.add('active'));
    srStatus.textContent='AngelBite. Сайт и сервер в тестировании и настройке. В скором времени будет доступно. Благодарю за внимание.';
    await delay(5200,token);if(token!==runId)return;
    ending.classList.add('fade-out');
    await delay(1250,token);if(token!==runId)return;
    blackout.classList.add('active');finished=true;stage.dataset.state='finished';
  }

  $('#start-button').addEventListener('click',openTrailer);
  pauseButton.addEventListener('click',()=>{if(!started||finished)return;setPaused(!paused);if(!paused)tone('soft')});
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;paintSound();if(soundOn)tone('land')});
  skipButton.addEventListener('click',()=>{if(started&&!finished)startFinale()});
  document.addEventListener('keydown',e=>{
    if(e.key===' '&&started&&!finished){e.preventDefault();setPaused(!paused);return}
    if(e.key==='Escape'&&started&&!finished){e.preventDefault();startFinale();return}
    if((e.key==='r'||e.key==='R')&&finished){e.preventDefault();location.reload()}
  });

  paintPause();
})();
