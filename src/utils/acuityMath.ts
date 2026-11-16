import { AcuityStep, StudentScreeningRecord, DiagnosticKPIs, SUSEvaluationRecord } from '../types';

/**
 * Configured visual-acuity display steps used by this application.
 * The values are geometric targets at a 2.0 m viewing distance, not evidence of
 * device calibration or clinical validation.
 * Physical height at 2.0 meters (2000 mm):
 * h = 2 * d * tan(5' / 2) * 10^(LogMAR)
 * For 6/6 (LogMAR 0.0): 2 * 2000 * tan(0.041667 deg) = 2.9089 mm
 */
export const SNELLEN_LADDER: AcuityStep[] = [
  { snellen: '6/60',  logmar: 1.00, mm: 29.09 },
  { snellen: '6/36',  logmar: 0.80, mm: 18.35 },
  { snellen: '6/24',  logmar: 0.60, mm: 11.58 },
  { snellen: '6/18',  logmar: 0.50, mm: 9.20 },
  { snellen: '6/12',  logmar: 0.30, mm: 5.80 },
  { snellen: '6/9.5', logmar: 0.20, mm: 4.61 },
  { snellen: '6/7.5', logmar: 0.10, mm: 3.66 },
  { snellen: '6/6',   logmar: 0.00, mm: 2.91 },
];

/** WHO (2025) Implementation Handbook: the binary referral cutoff is 6/12 (LogMAR >= 0.30). */
export const REFERRAL_LOGMAR_CUTOFF = 0.30;

/** WHO (2025) code 88 sentinel: untestable child = mandatory referral. */
export const UNTTESTABLE_LOGMAR = 88;
export const UNTTESTABLE_ACUITY_LABEL = '88 (غير قابل للفحص - إحالة وجوبية)';

export const LOGMAR_MAP: Record<string, number> = {
  // Censored result at the chart floor. 1.00 is a lower bound, not an exact acuity.
  'أقل من 6/60': 1.00,
  '6/60': 1.00,
  '6/36': 0.80,
  '6/24': 0.60,
  '6/18': 0.50,
  '6/12': 0.30,
  '6/9.5': 0.20,
  '6/7.5': 0.10,
  '6/6': 0.00,
  // WHO (2025) "Untestable Child" code. The child who cannot be tested is a
  // mandatory referral; the value is a sentinel code, not a measured acuity.
  [UNTTESTABLE_ACUITY_LABEL]: UNTTESTABLE_LOGMAR,
};

function getObservedLogmar(snellen: string | undefined, recordedLogmar: number | undefined): number | null {
  const label = snellen?.trim();
  if (!label) return null;
  // Tolerate the WHO untestable code written with or without its full label.
  if (label === '88' || label.startsWith('88 ')) return UNTTESTABLE_LOGMAR;
  const mapped = LOGMAR_MAP[label] ?? (label === '6/9' ? 0.2 : undefined);
  if (mapped !== undefined) return mapped;
  return Number.isFinite(recordedLogmar) ? Number(recordedLogmar) : null;
}

/**
 * Worse-seeing eye = Math.max(OD, OS) over valid numeric LogMAR scores.
 * The worse eye is the primary unit of analysis (Murdoch et al.). Returns NaN
 * when neither eye has a valid numeric score (exports as SPSS system-missing).
 */
export function worseEyeLogMAR(
  odLogmar: number | undefined,
  osLogmar: number | undefined
): number {
  const valid = [odLogmar, osLogmar].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  if (valid.length === 0) return Number.NaN;
  return Math.max(...valid);
}

/** True when either eye of the pair recorded the WHO untestable code (88). */
export function isUntestablePair(
  odLogmar: number | undefined,
  osLogmar: number | undefined
): boolean {
  return odLogmar === UNTTESTABLE_LOGMAR || osLogmar === UNTTESTABLE_LOGMAR;
}

function binaryFlag(value: unknown): 0 | 1 | null {
  if (value === 0 || value === '0') return 0;
  if (value === 1 || value === '1') return 1;
  return null;
}

export function hasDocumentedReference(record: StudentScreeningRecord): boolean {
  const validDate = typeof record.Gold_Standard_Date === 'string' && !Number.isNaN(Date.parse(record.Gold_Standard_Date));
  return Boolean(
    record.Gold_Standard_Method?.trim() &&
    record.Gold_Standard_Examiner_ID?.trim() &&
    validDate &&
    record.Gold_Standard_Criteria?.trim() &&
    ['YES', 'NO', 'UNKNOWN'].includes(record.Gold_Standard_Masked ?? '')
  );
}

/** Wilson score interval for a binomial proportion, returned as percentages. */
function wilsonInterval95(successes: number, total: number): [number, number] | null {
  if (total <= 0) return null;
  const z = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) / total) + (z * z) / (4 * total * total))) / denominator;
  return [+(Math.max(0, center - margin) * 100).toFixed(1), +(Math.min(1, center + margin) * 100).toFixed(1)];
}

/**
 * Hirschberg Ratio:
 * Approximate conversion used by this model: 1 mm corresponds to about 15 prism diopters.
 * The ratio varies and should not be treated as a definitive clinical measurement.
 */
export function convertHirschbergToPrism(decentrationMM: number): number {
  return Math.round(decentrationMM * 15);
}

/**
 * Calculate physical optotype height in pixels given pxPerMM
 */
export function getOptotypePixelSize(step: AcuityStep, pxPerMM: number, testingDistanceMeters = 2.0): number {
  const distanceFactor = (testingDistanceMeters || 2.0) / 2.0;
  return Math.max(9, Math.round(step.mm * distanceFactor * pxPerMM));
}

/**
 * Apply the application's configured screening flags. These labels are not clinical
 * diagnoses, referral-time recommendations, or evidence of guideline conformity.
 */
export function classifyClinicalDecision(
  odSnellen: string,
  osSnellen: string,
  hirschbergMM: number,
  mrd1MM: number,
  asthenopiaScore: number
): {
  urgency: 'MODEL_NO_FLAG' | 'MODEL_REVIEW' | 'MODEL_PRIORITY';
  categoryAr: string;
  categoryEn: string;
  detailsAr: string;
  referralCode: number;
} {
  const odLog = LOGMAR_MAP[odSnellen] ?? 0;
  const osLog = LOGMAR_MAP[osSnellen] ?? 0;
  const worstLog = Math.max(odLog, osLog);
  const iod = Math.abs(odLog - osLog);
  const hasStrabismus = hirschbergMM >= 1.0;
  const hasPtosis = mrd1MM < 2.5;

  // WHO (2025): a child recorded with the untestable code (88) in either eye is
  // a mandatory referral, independent of the remaining model rules.
  if (odLog === UNTTESTABLE_LOGMAR || osLog === UNTTESTABLE_LOGMAR) {
    const eyesText = odLog === UNTTESTABLE_LOGMAR && osLog === UNTTESTABLE_LOGMAR
      ? 'لكلا العينين'
      : odLog === UNTTESTABLE_LOGMAR
        ? 'للعين اليمنى'
        : 'للعين اليسرى';
    return {
      urgency: 'MODEL_PRIORITY',
      categoryAr: 'غير قابل للفحص (رمز 88) - إحالة وجوبية وفق WHO 2025',
      categoryEn: 'Untestable child (code 88) - mandatory referral',
      detailsAr: `سُجّل رمز 88 (غير قابل للفحص) ${eyesText}. وفق دليل WHO 2025، الطفل غير القابل للفحص يُحال وجوباً إلى المركز الصحي، ويُستكمل تقييمه هناك.`,
      referralCode: 1,
    };
  }

  if (hasStrabismus || hasPtosis || worstLog >= 0.80) {
    return {
      urgency: 'MODEL_PRIORITY',
      categoryAr: 'إشارة أولوية أعلى وفق قواعد النموذج',
      categoryEn: 'Higher-priority model flag',
      detailsAr: `تجاوزت قيمة أو أكثر من القيم المدخلة حد النموذج (${hasStrabismus ? 'منعكس قرني ' : ''}${hasPtosis ? 'MRD₁ ' : ''}${worstLog >= 0.8 ? 'حدة البصر ' : ''}). راجع القياس والبروتوكول المحلي لتحديد الإجراء؛ لا يحدد هذا الناتج تشخيصاً أو موعد إحالة.`,
      referralCode: 1,
    };
  }

  if (worstLog >= REFERRAL_LOGMAR_CUTOFF || iod >= 0.20 || asthenopiaScore >= 2) {
    return {
      urgency: 'MODEL_REVIEW',
      categoryAr: 'نتيجة تستدعي مراجعة وفق بروتوكول الدراسة',
      categoryEn: 'Model flag for protocol review',
      detailsAr: `تجاوزت النتيجة أحد حدود الفرز المبرمجة (${iod >= 0.2 ? `فرق العينين ${iod.toFixed(2)} LogMAR` : worstLog >= REFERRAL_LOGMAR_CUTOFF ? `أسوأ عين ${worstLog.toFixed(2)} LogMAR عند حد 6/12` : 'قائمة الأعراض'}). حدة البصر وحدها لا تحدد نوع الخطأ الانكساري.`,
      referralCode: 1,
    };
  }

  return {
    urgency: 'MODEL_NO_FLAG',
    categoryAr: 'لم تظهر إشارة إحالة وفق حدود النموذج الحالية',
    categoryEn: 'No referral flag under the current model rules',
    detailsAr: `نتائج السلم المسجلة: OD ${odSnellen} وOS ${osSnellen}. غياب إشارة النموذج لا يستبعد مشكلة بصرية ولا يغني عن التقييم السريري عند وجود أعراض أو مخاوف.`,
    referralCode: 0,
  };
}

/**
 * Generate CSV with UTF-8 BOM for Arabic language support in Excel and SPSS v.26
 */
export function generateSPSS_CSV(records: StudentScreeningRecord[]): string {
  if (records.length === 0) return '';
  const quote = (value: string | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = [
    'Child_ID',
    'Examiner_ID',
    'Paper_Examiner_ID',
    'Paper_Started_At',
    'Paper_Completed_At',
    'Smart_Examiner_ID',
    'Smart_Started_At',
    'Smart_Completed_At',
    'Parental_Consent',
    'Examination_Date',
    'School_Name',
    'School_Sector',
    'Grade_Level',
    'Age_Years',
    'Gender',
    'Wears_Glasses',
    'Crossover_Sequence',
    'Paper_Snellen_OD',
    'Paper_LogMAR_OD',
    'Paper_Snellen_OS',
    'Paper_LogMAR_OS',
    'Paper_LogMAR_Worse',
    'Paper_Time_Sec',
    'Paper_Referral',
    'Smart_Snellen_OD',
    'Smart_LogMAR_OD',
    'Smart_Snellen_OS',
    'Smart_LogMAR_OS',
    'Smart_LogMAR_Worse',
    'Smart_IOD_LogMAR',
    'Smart_Time_Sec',
    'Hirschberg_Asym_mm',
    'Hirschberg_Prism_Diopters',
    'MRD1_Min_mm',
    'Triage_Ocular_Flag',
    'AI_Quality_Flag',
    'Asthenopia_Score',
    'Final_Triage_Referral',
    'Referral_Urgency',
    'Referral_PHCC',
    'FollowUp_Status',
    'Spectacles_Prescribed_Fitted',
    'Gold_Standard_Confirmed',
    'Gold_Standard_Method',
    'Gold_Standard_Examiner_ID',
    'Gold_Standard_Date',
    'Gold_Standard_Criteria',
    'Gold_Standard_Masked'
  ];

  const rows = records.map(r => [
    quote(r.Child_ID),
    quote(r.Examiner_ID),
    quote(r.Paper_Examiner_ID),
    quote(r.Paper_Started_At),
    quote(r.Paper_Completed_At),
    quote(r.Smart_Examiner_ID),
    quote(r.Smart_Started_At),
    quote(r.Smart_Completed_At),
    r.Parental_Consent,
    quote(r.Examination_Date),
    quote(r.School_Name),
    quote(r.School_Sector),
    r.Grade_Level,
    r.Age_Years,
    quote(r.Gender),
    r.Wears_Glasses,
    quote(r.Crossover_Sequence),
    quote(r.Paper_Snellen_OD),
    r.Paper_LogMAR_OD,
    quote(r.Paper_Snellen_OS),
    r.Paper_LogMAR_OS,
    // Worse-seeing eye = Math.max(OD, OS); recomputed for records saved before this field existed.
    r.Paper_LogMAR_Worse ?? worseEyeLogMAR(r.Paper_LogMAR_OD, r.Paper_LogMAR_OS),
    r.Paper_Time_Sec,
    r.Paper_Referral,
    quote(r.Smart_Snellen_OD),
    r.Smart_LogMAR_OD,
    quote(r.Smart_Snellen_OS),
    r.Smart_LogMAR_OS,
    r.Smart_LogMAR_Worse ?? worseEyeLogMAR(r.Smart_LogMAR_OD, r.Smart_LogMAR_OS),
    r.Smart_IOD_LogMAR,
    r.Smart_Time_Sec,
    r.Hirschberg_Asym_mm,
    r.Hirschberg_Prism_Diopters,
    r.MRD1_Min_mm,
    r.Triage_Ocular_Flag,
    r.AI_Quality_Flag ?? '',
    r.Asthenopia_Score,
    r.Final_Triage_Referral,
    quote(r.Referral_Urgency),
    quote(r.Referral_PHCC),
    r.FollowUp_Status,
    r.Spectacles_Prescribed_Fitted ?? '',
    r.Gold_Standard_Confirmed ?? 99,
    quote(r.Gold_Standard_Method),
    quote(r.Gold_Standard_Examiner_ID),
    quote(r.Gold_Standard_Date),
    quote(r.Gold_Standard_Criteria),
    quote(r.Gold_Standard_Masked)
  ].join(','));

  // UTF-8 BOM: \uFEFF
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}

/**
 * Calculate Advanced Diagnostic Performance & Agreement Statistics:
 * 1. Cohen's Kappa (κ) between Conventional Paper (6m) and Smart Mobile (2m)
 * 2. Sensitivity (%), Specificity (%), PPV (%), NPV (%), and Accuracy (%) against Gold Standard
 */
export function calculateDiagnosticMetrics(records: StudentScreeningRecord[]): DiagnosticKPIs {
  const totalN = records.length;
  if (totalN === 0) {
    return {
      totalN: 0,
      paperCompleteN: 0,
      smartCompleteN: 0,
      pairedN: 0,
      kappa: null,
      kappaInterpretation: 'لا توجد بيانات كافية',
      observedAgreement: 0,
      expectedAgreement: 0,
      contingencyPaperSmart: { bothRefer: 0, paperOnly: 0, smartOnly: 0, bothNormal: 0 },
      goldEvaluatedN: 0,
      sensitivity: null,
      specificity: null,
      ppv: null,
      npv: null,
      accuracy: null,
      sensitivityCI95: null,
      specificityCI95: null,
      ppvCI95: null,
      npvCI95: null,
      verifiedRate: null,
      contingencySmartGold: { tp: 0, fp: 0, fn: 0, tn: 0 },
      timedN: 0,
      meanTimeSavedSec: null,
    };
  }

  // 1. Contingency Paper vs Smart
  let a = 0; // Paper=1, Smart=1
  let b = 0; // Paper=1, Smart=0
  let c = 0; // Paper=0, Smart=1
  let d = 0; // Paper=0, Smart=0
  let totalSavedSec = 0;
  let pairedN = 0;
  let paperCompleteN = 0;
  let smartCompleteN = 0;
  let timedN = 0;

  records.forEach((r) => {
    const paperOd = getObservedLogmar(r.Paper_Snellen_OD, r.Paper_LogMAR_OD);
    const paperOs = getObservedLogmar(r.Paper_Snellen_OS, r.Paper_LogMAR_OS);
    const smartOd = getObservedLogmar(r.Smart_Snellen_OD, r.Smart_LogMAR_OD);
    const smartOs = getObservedLogmar(r.Smart_Snellen_OS, r.Smart_LogMAR_OS);
    const paperComplete = paperOd !== null && paperOs !== null;
    const smartComplete = smartOd !== null && smartOs !== null;
    if (paperComplete) paperCompleteN++;
    if (smartComplete) smartCompleteN++;
    if (!paperComplete || !smartComplete) return;

    // Compare visual-acuity referral outcomes only; ocular triage must not contaminate Smart method agreement.
    // WHO (2025) cutoff: 6/12 => LogMAR >= 0.30; code 88 (untestable) always refers (88 >= 0.30).
    const pRef = Math.max(paperOd, paperOs) >= REFERRAL_LOGMAR_CUTOFF ? 1 : 0;
    const sRef = Math.max(smartOd, smartOs) >= REFERRAL_LOGMAR_CUTOFF ? 1 : 0;
    if (pRef === 1 && sRef === 1) a++;
    else if (pRef === 1 && sRef === 0) b++;
    else if (pRef === 0 && sRef === 1) c++;
    else d++;

    pairedN++;
    if (Number.isFinite(r.Paper_Time_Sec) && Number.isFinite(r.Smart_Time_Sec) && r.Paper_Time_Sec > 0 && r.Smart_Time_Sec > 0) {
      totalSavedSec += r.Paper_Time_Sec - r.Smart_Time_Sec;
      timedN++;
    }
  });

  const observedAgreement = pairedN > 0 ? (a + d) / pairedN : 0;
  const pPaper1 = pairedN > 0 ? (a + b) / pairedN : 0;
  const pPaper0 = pairedN > 0 ? (c + d) / pairedN : 0;
  const pSmart1 = pairedN > 0 ? (a + c) / pairedN : 0;
  const pSmart0 = pairedN > 0 ? (b + d) / pairedN : 0;
  const expectedAgreement = (pPaper1 * pSmart1) + (pPaper0 * pSmart0);

  const kappa = pairedN > 0 && expectedAgreement < 1
    ? (observedAgreement - expectedAgreement) / (1 - expectedAgreement)
    : null;

  let kappaInterpretation = pairedN === 0
    ? 'لا توجد أزواج فحص مكتملة'
    : kappa === null
      ? 'غير محدد: لا يوجد تباين كافٍ'
    : 'اتساق مرتفع (تفسير استرشادي)';
  if (kappa !== null && kappa < 0.20) kappaInterpretation = 'اتساق طفيف (Slight Agreement)';
  else if (kappa !== null && kappa < 0.40) kappaInterpretation = 'اتساق مقبول (Fair Agreement)';
  else if (kappa !== null && kappa < 0.60) kappaInterpretation = 'اتساق متوسط (Moderate Agreement)';
  else if (kappa !== null && kappa < 0.80) kappaInterpretation = 'اتساق جوهري عالي (Substantial Agreement)';

  // 2. Gold Standard Validation Metrics
  let tp = 0; // Smart=1, Gold=1
  let fp = 0; // Smart=1, Gold=0
  let fn = 0; // Smart=0, Gold=1
  let tn = 0; // Smart=0, Gold=0

  const goldRecords = records.filter((r) =>
    binaryFlag(r.Gold_Standard_Confirmed) !== null && hasDocumentedReference(r) &&
    getObservedLogmar(r.Smart_Snellen_OD, r.Smart_LogMAR_OD) !== null &&
    getObservedLogmar(r.Smart_Snellen_OS, r.Smart_LogMAR_OS) !== null
  );
  const goldEvaluatedN = goldRecords.length;

  goldRecords.forEach((r) => {
    // The diagnostic-accuracy endpoint is digital visual acuity alone. The composite
    // model referral flag also includes ocular and symptom inputs.
    const smartOd = getObservedLogmar(r.Smart_Snellen_OD, r.Smart_LogMAR_OD)!;
    const smartOs = getObservedLogmar(r.Smart_Snellen_OS, r.Smart_LogMAR_OS)!;
    // WHO (2025) cutoff 6/12 (LogMAR >= 0.30); code 88 (untestable) always refers.
    const sRef: 0 | 1 = Math.max(smartOd, smartOs) >= REFERRAL_LOGMAR_CUTOFF ? 1 : 0;
    const gRef = binaryFlag(r.Gold_Standard_Confirmed)!;
    if (sRef === 1 && gRef === 1) tp++;
    else if (sRef === 1 && gRef === 0) fp++;
    else if (sRef === 0 && gRef === 1) fn++;
    else tn++;
  });

  const sensitivity = tp + fn > 0 ? +((tp / (tp + fn)) * 100).toFixed(1) : null;
  const specificity = tn + fp > 0 ? +((tn / (tn + fp)) * 100).toFixed(1) : null;
  const ppv = tp + fp > 0 ? +((tp / (tp + fp)) * 100).toFixed(1) : null;
  const npv = tn + fn > 0 ? +((tn / (tn + fn)) * 100).toFixed(1) : null;
  const accuracy = goldEvaluatedN > 0 ? +(((tp + tn) / goldEvaluatedN) * 100).toFixed(1) : null;

  return {
    totalN,
    paperCompleteN,
    smartCompleteN,
    pairedN,
    kappa: kappa === null ? null : +kappa.toFixed(3),
    kappaInterpretation,
    observedAgreement: +(observedAgreement * 100).toFixed(1),
    expectedAgreement: +(expectedAgreement * 100).toFixed(1),
    contingencyPaperSmart: { bothRefer: a, paperOnly: b, smartOnly: c, bothNormal: d },
    goldEvaluatedN,
    sensitivity,
    specificity,
    ppv,
    npv,
    accuracy,
    sensitivityCI95: wilsonInterval95(tp, tp + fn),
    specificityCI95: wilsonInterval95(tn, tn + fp),
    ppvCI95: wilsonInterval95(tp, tp + fp),
    npvCI95: wilsonInterval95(tn, tn + fn),
    verifiedRate: totalN > 0 ? +((goldEvaluatedN / totalN) * 100).toFixed(1) : null,
    contingencySmartGold: { tp, fp, fn, tn },
    timedN,
    meanTimeSavedSec: timedN > 0 ? +(totalSavedSec / timedN).toFixed(1) : null,
  };
}

/**
 * Generate CSV for SUS evaluations with UTF-8 BOM for SPSS v.26
 */
export function generateSUS_CSV(evaluations: SUSEvaluationRecord[]): string {
  if (evaluations.length === 0) return '';
  const headers = [
    'Evaluation_ID',
    'Examiner_ID',
    'Examiner_Name',
    'PHCC_Or_Hospital',
    'Role',
    'Evaluation_Date',
    'Q1_Frequent_Use',
    'Q2_Complexity',
    'Q3_Ease_Of_Use',
    'Q4_Tech_Support_Needed',
    'Q5_Functions_Integrated',
    'Q6_Inconsistency',
    'Q7_Fast_Learning',
    'Q8_Cumbersome',
    'Q9_Confident',
    'Q10_Learn_A_Lot',
    'SUS_Raw_Sum',
    'SUS_Total_Score',
    'Grade',
    'Acceptability',
    'Notes'
  ];

  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = evaluations.map((e) => {
    let rawSum = 0;
    e.answers.forEach((v, idx) => {
      rawSum += (idx % 2 === 0) ? (v - 1) : (5 - v);
    });
    return [
      quote(e.id),
      quote(e.examinerId),
      quote(e.examinerName),
      quote(e.phccOrHospital),
      quote(e.role),
      quote(e.evaluationDate),
      ...e.answers,
      rawSum,
      e.susScore,
      quote('درجة وصفية'),
      quote('لا توجد عتبات تفسير محلية موثقة'),
      quote(e.notes)
    ].join(',');
  });

  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}
