import { useEffect } from 'react';
import { equalTo, off, onValue, orderByChild, query as rtdbQuery, ref } from 'firebase/database';
import { database } from '@/lib/firebase';
import {
  useDisciplineStore,
  DisciplineRecord,
  DisciplineRule,
  DISCIPLINE_RULES_BY_SCHOOL_ROOT,
} from '@/store/useDisciplineStore';

const normalizeSchoolScope = (schoolId?: string) => String(schoolId || "").trim().toLowerCase();

const toRuleArray = (data: unknown): DisciplineRule[] => {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data as Record<string, any>).map(([key, value]: [string, any]) => ({
    ...value,
    id: Number(value?.id ?? key),
  }));
};

export function useDisciplineSync(schoolId?: string) {
  const { setRecords, setRules } = useDisciplineStore();

  useEffect(() => {
    const scopedSchoolId = normalizeSchoolScope(schoolId);
    if (!scopedSchoolId) {
      setRecords([]);
      return;
    }
    const scopedRulesRef = scopedSchoolId
      ? ref(database, `${DISCIPLINE_RULES_BY_SCHOOL_ROOT}/${scopedSchoolId}`)
      : null;
    let defaultRulesCache: DisciplineRule[] = [];
    let scopedRulesCache: DisciplineRule[] = [];

    const applyRules = () => {
      if (scopedRulesCache.length > 0) {
        setRules(scopedRulesCache);
        return;
      }
      setRules(defaultRulesCache);
    };

    // 1. Sync Rules
    const rulesRef = ref(database, 'discipline_rules');
    const unsubscribeRules = onValue(rulesRef, (snapshot) => {
      defaultRulesCache = toRuleArray(snapshot.val());
      applyRules();
    });
    const unsubscribeScopedRules = scopedRulesRef
      ? onValue(scopedRulesRef, (snapshot) => {
          scopedRulesCache = toRuleArray(snapshot.val());
          applyRules();
        })
      : () => {};

    // 2. Sync Records
    const recordsRef = rtdbQuery(ref(database, 'discipline_records'), orderByChild('schoolId'), equalTo(scopedSchoolId));
    const unsubscribeRecords = onValue(recordsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRecords([]);
        return;
      }
      const data = snapshot.val();
      const recordsArray: DisciplineRecord[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          ...value,
          id: value?.id ?? key,
        }))
        .filter((record) => normalizeSchoolScope(record.schoolId) === scopedSchoolId);
      setRecords(recordsArray);
    });

    return () => {
      off(rulesRef);
      if (scopedRulesRef) off(scopedRulesRef);
      off(recordsRef);
      unsubscribeRules();
      unsubscribeScopedRules();
      unsubscribeRecords();
    };
  }, [schoolId, setRules, setRecords]);
}
