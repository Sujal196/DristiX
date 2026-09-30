import { useEffect, useState } from 'react';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { useExamStore } from '../store/useExamStore';
import { isHindiPreferred } from '../utils/voiceRecognition';
import { soundEffects } from '../utils/soundEffects';
import { offlinePracticeStorage } from '../services/offlinePracticeStorage';
import { getDataSource } from '../services/dataSource';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      soundEffects.playSuccess();
      const isHindi = isHindiPreferred();

      useAnnouncerStore
        .getState()
        .announce(
          isHindi
            ? 'इंटरनेट कनेक्शन पुनः जुड़ गया है।'
            : 'Internet connection restored.',
          'polite',
          true
        );

      // Flush any queued offline practice submissions to server
      try {
        const queued = await offlinePracticeStorage.getOfflineSubmissions();
        if (queued && queued.length > 0) {
          for (const item of queued) {
            try {
              if (item.attemptId && item.state) {
                await getDataSource().exams.submitAttempt(item.attemptId, item.state);
              }
              if (item.id) {
                await offlinePracticeStorage.clearOfflineSubmission(item.id);
              }
            } catch (err) {
              console.warn('[OfflineSync] Could not flush attempt:', err);
            }
          }
          useAnnouncerStore
            .getState()
            .announce(
              isHindi
                ? 'ऑफलाइन प्रैक्टिस रिकॉर्ड सर्वर के साथ सुरक्षित रूप से सिंक हो गया है।'
                : 'Offline practice submissions synced successfully.',
              'polite',
              true
            );
        }

        // Flush any queued offline feedbacks to server
        const queuedFeedbacks = await offlinePracticeStorage.getOfflineFeedbacks();
        if (queuedFeedbacks && queuedFeedbacks.length > 0) {
          for (const fb of queuedFeedbacks) {
            try {
              await getDataSource().exams.submitFeedback({
                examId: String(fb.examId || 'exam_default'),
                examTitle: String(fb.examTitle || 'Examination'),
                rating: Number(fb.rating) || 5,
                tags: Array.isArray(fb.tags) ? fb.tags : [],
                comment: String(fb.comment || ''),
                inputMethod: (fb.inputMethod as any) || 'keyboard',
                studentRoll: String(fb.studentRoll || ''),
                studentName: String(fb.studentName || 'Candidate'),
              });
              if (fb.id) {
                await offlinePracticeStorage.clearOfflineFeedback(fb.id);
              }
            } catch (fbErr) {
              console.warn('[OfflineSync] Could not flush feedback:', fbErr);
            }
          }
        }
      } catch (syncErr) {
        console.warn('[OfflineSync] Error syncing queued data:', syncErr);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      soundEffects.playTimerAlert();
      const isHindi = isHindiPreferred();
      const { portalTab, examMode, activeView } = useExamStore.getState();

      const isPractice = portalTab === 'practice' || examMode === 'practice';
      if (isPractice || activeView === 'exam') {
        useAnnouncerStore
          .getState()
          .announce(
            isHindi
              ? 'सावधान: इंटरनेट कनेक्शन कट गया है। घबराएं नहीं, आप प्रैक्टिस एरिना में बिना इंटरनेट के अभ्यास जारी रख सकते हैं। आपके उत्तर पूरी तरह सुरक्षित हैं।'
              : 'Alert: Internet connection disconnected. You can continue practicing in the Practice Arena completely offline. Your answers are safe.',
            'assertive',
            true
          );
      } else {
        useAnnouncerStore
          .getState()
          .announce(
            isHindi
              ? 'इंटरनेट कनेक्शन उपलब्ध नहीं है। DristiX प्रैक्टिस एरिना ऑफलाइन मोड में चालू है।'
              : 'Internet connection is unavailable. DristiX Practice Arena is ready for offline practice.',
            'polite',
            true
          );
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[DristiX SW] Registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('[DristiX SW] Registration failed:', err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
