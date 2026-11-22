export interface AcuityStep {
  snellen: string;
  logmar: number;
  mm: number; // Height in mm at 2.0m distance
}

export type WHOYesNoUnknown = 'YES' | 'NO' | 'UNKNOWN';
export type WHOSpectaclesStatus = 'NONE' | 'DISTANCE' | 'NEAR' | 'UNKNOWN';
export type WHOVisionStatus = 'PASS' | 'REFER' | 'UNTESTABLE';

/** WHO handbook pre-screen responses. These are history flags, not diagnoses. */
export interface WHOPreScreenResponses {
  childAssent: 'YES' | 'NO';
  diabetes: WHOYesNoUnknown;
  eyePainOrSevereItch: WHOYesNoUnknown;
  parentVisionConcern: WHOYesNoUnknown;
  parentHearingConcern: WHOYesNoUnknown;
  teacherVisionConcern: WHOYesNoUnknown;
  learningConcern: WHOYesNoUnknown;
  spectacles: WHOSpectaclesStatus;
  hearingAids: WHOYesNoUnknown;
}

export type WHOPreScreenDraft = {
  [Key in keyof WHOPreScreenResponses]: WHOPreScreenResponses[Key] | '';
};

/** Separate WHO-style school screen record; never substituted into the 6m/2m study endpoints. */
export interface WHOScreeningAssessment {
  examinerId: string;
  startedAt: string;
  completedAt: string;
  chartMethod: 'HOTV_MATCHING_CARD' | 'TUMBLING_E_DIRECTION';
  chartDistanceM: number;
  odTopCorrect: number | null;
  odBottomCorrect: number | null;
  osTopCorrect: number | null;
  osBottomCorrect: number | null;
  odStatus: WHOVisionStatus | null;
  osStatus: WHOVisionStatus | null;
  externalEyeScreenCompleted: boolean;
  externalEyeFindings: string[];
  externalEyeOther: string;
}

export interface StudentScreeningRecord {
  Child_ID: string;
  Child_Name?: string;
  Examiner_ID: string;
  /** Full triple name of the examiner on duty (e.g. "أحمد محمد علي"). */
  Examiner_Full_Name?: string;
  /** Stable per-device identifier used to attribute every record. */
  Device_ID?: string;
  /**
   * Supabase account that owns this row (`auth.uid()`).
   * Set on upload; populated when an admin pulls the whole dataset.
   */
  Owner_ID?: string;
  /** Optional local sync metadata; not persisted to Supabase. */
  _syncStatus?: 'pending' | 'synced';

  /** Independent station identities and completion times; optional for older records. */
  Paper_Examiner_ID?: string;
  Paper_Started_At?: string;
  Paper_Completed_At?: string;
  Smart_Examiner_ID?: string;
  Smart_Started_At?: string;
  Smart_Completed_At?: string;
  Parental_Consent: number; // 1 = Yes, 0 = No
  Child_Assent?: 'YES' | 'NO';
  Examination_Date: string; // ISO string
  School_Name: string;
  School_Sector: string; // "حكومي حضري" | "حكومي ريفي" | "أهلي"
  Grade_Level: number; // 1 to 6
  Age_Years: number; // 5 to 14
  Gender: string; // "ذكر" | "أنثى"
  Wears_Glasses: number; // 0 = No, 1 = Yes
  WHO_PreScreen?: WHOPreScreenResponses;
  WHO_Screening?: WHOScreeningAssessment;
  /** Separate WHO pathway result; excluded from the study's 6m-vs-2m agreement endpoint. */
  WHO_Referral_Flag?: number;
  Crossover_Sequence: string; // "ورقي (6m) ← رقمي (2m)" or "رقمي (2m) ← ورقي (6m)"

  // Station 1: Paper Wall Chart (6m)
  Paper_Snellen_OD: string;
  Paper_LogMAR_OD: number;
  Paper_Snellen_OS: string;
  Paper_LogMAR_OS: number;
  /** Worse-seeing eye = Math.max(OD, OS) for valid numeric LogMAR; primary unit of analysis (Murdoch et al.). */
  Paper_LogMAR_Worse?: number;
  Paper_Time_Sec: number;
  /** Binary referral at the WHO (2025) 6/12 cutoff: LogMAR >= 0.30. Code 88 (untestable) always = 1. */
  Paper_Referral: number; // 0 = below the configured threshold, 1 = at/above it

  // Station 2: Smart Mobile Screening (2m)
  Smart_Snellen_OD: string;
  Smart_Acuity_OD_Below_Test_Range?: boolean;
  Smart_LogMAR_OD: number;
  Smart_Snellen_OS: string;
  Smart_Acuity_OS_Below_Test_Range?: boolean;
  Smart_LogMAR_OS: number;
  /** Worse-seeing eye = Math.max(OD, OS) for valid numeric LogMAR; primary unit of analysis (Murdoch et al.). */
  Smart_LogMAR_Worse?: number;
  Smart_IOD_LogMAR: number; // Inter-ocular difference
  Smart_Time_Sec: number;

  // Station 2-B: Ocular Biometry & Hirschberg
  /** Net inter-ocular reflex asymmetry in mm (i.e., difference between the two corneal reflex positions,
   *  documented after the fixed 0.5 mm Angle-Kappa adjustment). Not a single-eye decentration value. */
  Hirschberg_Asym_mm: number;
  /** Hirschberg_Asym_mm * 15 (approx. 15 prism diopters per mm); referral at >= 15Δ or MRD1_Min_mm < 2.5. */
  Hirschberg_Prism_Diopters: number;
  MRD1_Min_mm: number; // Margin reflex distance
  Triage_Ocular_Flag: number; // 0 = no coded model flag, 1 = Hirschberg flag, 2 = MRD1 flag, 3 = both
  /** Capture provenance of the AI biometry reading: 1 = Auto, 2 = Retake, 3 = Manual Tap Fallback. */
  AI_Quality_Flag?: number;

  // Asthenopia Checklist Score (0 to 5)
  Asthenopia_Score: number;

  // Final Clinical Decision Support
  Final_Triage_Referral: number; // 0 = no coded model referral flag, 1 = model referral flag
  /** Model category only. Legacy time-based values remain readable for existing records. */
  Referral_Urgency: 'MODEL_NO_FLAG' | 'MODEL_REVIEW' | 'MODEL_PRIORITY' | 'ROUTINE' | 'PHCC_2WEEKS' | 'URGENT_48H';
  Referral_PHCC: string;
  /** Visit-2 audit categories (4 protocol categories):
   *  0 = غير محال (Not Referred)
   *  1 = راجع المركز الصحي الحكومي (Attended Public PHCC)
   *  2 = راجع عيادة خاصة (Attended Private Care)
   *  3 = متسرب حقيقي بعد شهر (True 1-Month Referral Loss) */
  FollowUp_Status: number;
  /** Visit-2 audit: 0 = لم يستلم نظارة, 1 = تم وصف وتجهيز النظارة من المركز الحكومي. */
  Spectacles_Prescribed_Fitted?: number;
  Gold_Standard_Confirmed?: number; // 0 = reference negative, 1 = reference positive, 99 = not entered
  /** Free-text fields must reflect the approved independent reference procedure. */
  Gold_Standard_Method?: string;
  Gold_Standard_Examiner_ID?: string;
  Gold_Standard_Date?: string;
  Gold_Standard_Criteria?: string;
  Gold_Standard_Masked?: 'YES' | 'NO' | 'UNKNOWN';
  /** URL to compressed eye photo stored in Supabase Storage; not part of SPSS export. */
  Eye_Photo_URL?: string;
}

export interface CalibrationData {
  pxPerMM: number;
  referenceType: 'CARD_85_6' | 'RULER_50';
  referenceLengthMM: number;
  sliderPixelWidth: number;
  estimatedDPI: number;
  lastCalibratedDate: string;
  /** True only after the displayed reference has been physically matched on this device. */
  isCalibrated?: boolean;
  /** Viewing distance for optotype scaling in meters. WHO 2025 supports 2.0m and 3.0m */
  testingDistanceMeters?: number;
}

export interface SUSResponse {
  scores: number[]; // 1 to 5 for 10 questions
  totalScore: number;
  grade: string;
  evaluatorRole: string;
}

export interface SUSEvaluationRecord {
  id: string;
  examinerId: string;
  examinerName: string;
  phccOrHospital: string;
  role: string;
  evaluationDate: string;
  answers: number[]; // 10 items (1-5)
  susScore: number; // 0 to 100
  grade: string;
  acceptability: string;
  notes?: string;
}

export interface DiagnosticKPIs {
  totalN: number;
  paperCompleteN: number;
  smartCompleteN: number;
  pairedN: number;
  // Cohen's Kappa between Conventional Paper (6m) and Smart Mobile (2m)
  kappa: number | null;
  kappaInterpretation: string;
  observedAgreement: number; // Po percentage
  expectedAgreement: number; // Pe percentage
  // 2x2 contingency Paper vs Smart
  contingencyPaperSmart: {
    bothRefer: number;      // a
    paperOnly: number;      // b
    smartOnly: number;      // c
    bothNormal: number;     // d
  };
  // Gold Standard Validation Metrics
  goldEvaluatedN: number;
  sensitivity: number | null; // TP / (TP + FN) %
  specificity: number | null; // TN / (TN + FP) %
  ppv: number | null;         // TP / (TP + FP) %
  npv: number | null;         // TN / (TN + FN) %
  accuracy: number | null;    // (TP + TN) / Total %
  sensitivityCI95: [number, number] | null;
  specificityCI95: [number, number] | null;
  ppvCI95: [number, number] | null;
  npvCI95: [number, number] | null;
  verifiedRate: number | null;
  // 2x2 contingency Smart vs Gold
  contingencySmartGold: {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
  };
  // Time efficiency
  timedN: number;
  meanTimeSavedSec: number | null;
}
