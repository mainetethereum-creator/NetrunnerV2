/** Quiet synthesized city hum, fountain and rainfall. Audio starts only from the
 * settings button's user gesture, never from page load or a saved preference. */
export function createGardenAmbience() {
  let context:AudioContext|undefined,master:GainNode|undefined,rainGain:GainNode|undefined;
  let disposed=false,enabled=false,paused=false,raining=false;
  const sources:AudioScheduledSourceNode[]=[];
  function mix() {
    if(!context||!master)return;
    master.gain.setTargetAtTime(enabled && !paused ? .24 : 0,context.currentTime,.35);
    rainGain?.gain.setTargetAtTime(raining ? .055 : 0,context.currentTime,.5);
  }
  return {
    async setEnabled(value:boolean) {
      if(disposed)return false;
      if(value&&!context) {
        try {
          context=new AudioContext();master=context.createGain();master.gain.value=0;master.connect(context.destination);
          const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),data=buffer.getChannelData(0);
          let seed=4598;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
          for(const [frequency,gain,type] of [[230,.13,'lowpass'],[1350,.07,'bandpass'],[3100,0,'highpass']] as const) {
            const source=context.createBufferSource();source.buffer=buffer;source.loop=true;sources.push(source);
            const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.3;
            const volume=context.createGain();volume.gain.value=gain;source.connect(filter);filter.connect(volume);volume.connect(master);source.start();
            if(type==='highpass')rainGain=volume;
          }
          const hum=context.createOscillator(),humGain=context.createGain();hum.frequency.value=55;humGain.gain.value=.018;
          hum.connect(humGain);humGain.connect(master);hum.start();sources.push(hum);
        } catch {void context?.close();context=undefined;sources.length=0;return false;}
      }
      if(value&&context) {try {await context.resume();}catch{return false;}}
      if(disposed)return false;
      enabled=value;mix();return enabled;
    },
    setPaused(value:boolean) {paused=value;mix();},
    setRain(value:boolean) {raining=value;mix();},
    dispose() {if(disposed)return;disposed=true;for(const source of sources)source.stop();void context?.close();},
  };
}
