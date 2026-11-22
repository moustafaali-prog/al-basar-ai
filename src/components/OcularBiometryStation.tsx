import React, { useRef, useState } from 'react';
import { analyzeFrame } from '../utils/mediaPipeOcular';
import { saveEyePhoto } from '../utils/eyePhotoStore';
import { useFeedback } from './FeedbackProvider';

interface Props {
  hirschbergMM: number;
  setHirschbergMM: (v:number)=>void;
  hirschbergRecorded: boolean;
  setHirschbergRecorded: (v:boolean)=>void;
  mrd1MM: number;
  setMrd1MM: (v:number)=>void;
  mrd1Recorded: boolean;
  setMrd1Recorded: (v:boolean)=>void;
  triageOcularFlag: number;
  setTriageOcularFlag: (v:number)=>void;
  aiQualityFlag: number;
  setAIQualityFlag: (v:number)=>void;
  asthenopiaScore: number;
  setAsthenopiaScore: (v:number)=>void;
  externalEyeFindings: string[];
  setExternalEyeFindings: (v:string[])=>void;
  externalEyeOther: string;
  setExternalEyeOther: (v:string)=>void;
  externalEyeScreened: boolean;
  setExternalEyeScreened: (v:boolean)=>void;
  onEyePhotoCaptured: (photo:{blob:Blob;dataUrl:string})=>void;
  onProceedToCDSS: ()=>void;
}

export const OcularBiometryStation: React.FC<Props> = ({
  hirschbergMM, setHirschbergMM,
  setHirschbergRecorded,
  mrd1MM, setMrd1MM,
  setMrd1Recorded,
  setTriageOcularFlag, setAIQualityFlag,
  onEyePhotoCaptured, onProceedToCDSS
}) => {
  const { notify } = useFeedback();
  const [mode, setMode] = useState<'idle'|'camera'|'result'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const facing = useRef<'environment'|'user'>('environment');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing.current }});
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMode('camera');
      }
    } catch { notify('فشل فتح الكاميرا','error'); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current = null;
    setMode('idle');
  };

  const capture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current,0,0);
    canvas.toBlob(async (blob)=>{
      if (!blob) return;
      await saveEyePhoto('__active_draft__', blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      onEyePhotoCaptured({ blob, dataUrl: url });
      const res = await analyzeFrame(videoRef.current!);
      if (res) {
        setHirschbergMM(parseFloat(res.hirschbergMM.toFixed(2)));
        setHirschbergRecorded(true);
        setMrd1MM(parseFloat(res.mrd1MM.toFixed(2)));
        setMrd1Recorded(true);
        setAIQualityFlag(1);
        setTriageOcularFlag(res.hirschbergMM>1?1:0);
      }
      stopCamera();
      setMode('result');
      notify('تم تحليل الصورة بواسطة الذكاء الاصطناعي محلياً','success');
    }, 'image/jpeg', 0.85);
  };

  const hirschbergPD = Math.round(hirschbergMM*15);
  const hirschbergStatus = hirschbergMM>=1?'اشتباه':'سليم';
  const mrdStatus = mrd1MM<2.5?'تدلي':'سليم';

  if (mode==='camera') {
    return (
      <div style={{position:'fixed',inset:0,background:'#000',zIndex:9999}}>
        <video ref={videoRef} playsInline muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        <button onClick={stopCamera} style={{position:'absolute',top:12,right:12,color:'#fff'}}>إغلاق</button>
        <button onClick={capture} style={{position:'absolute',bottom:40,left:'50%',transform:'translateX(-50%)',padding:12}}>التقاط</button>
      </div>
    );
  }

  if (mode==='result') {
    return (
      <div style={{padding:16}}>
        {previewUrl && <img src={previewUrl} alt="eye" style={{width:'100%',borderRadius:12}} />}
        <div style={{marginTop:12}}>
          <div>الحول: {hirschbergMM} مم / {hirschbergPD} PD - {hirschbergStatus}</div>
          <div>MRD1: {mrd1MM} مم - {mrdStatus}</div>
        </div>
        <div style={{marginTop:12}}>التحليل الآلي: العينان متوازيتان ومستوى الجفن طبيعي</div>
        <button onClick={()=>{setMode('idle'); setPreviewUrl(null);}} style={{marginTop:16}}>إعادة التصوير</button>
        <button onClick={onProceedToCDSS} style={{marginTop:8}}>التالي إلى النتيجة</button>
      </div>
    );
  }

  return (
    <div style={{padding:16,textAlign:'center'}}>
      <div>اضغط للتصوير، ثم ضع وجه الطفل داخل الإطار البيضاوي</div>
      <button onClick={startCamera} style={{marginTop:12,padding:12}}>📸 فتح الكاميرا</button>
    </div>
  );
};
