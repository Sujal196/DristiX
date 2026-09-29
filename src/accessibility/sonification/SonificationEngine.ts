import { earconManager } from '../audio/EarconManager';
import { hapticManager } from '../haptic/HapticManager';
import { speechEngine } from '../../utils/speechEngine';
import type { QuestionGraph, GraphDataPoint } from '../../../shared/types';

export type TrendDirection = 'RISING' | 'FALLING' | 'UNCHANGED';

export interface TrendAnalysisResult {
  direction: TrendDirection;
  verbal: string;
  diff: number;
}

export interface GraphStats {
  min: number;
  max: number;
  minPoint: GraphDataPoint | null;
  maxPoint: GraphDataPoint | null;
  totalPoints: number;
  sum: number;
  average: number;
}

/**
 * SonificationEngine
 *
 * Implements mathematical pitch normalization, spatial panning (StereoPannerNode),
 * trend detection, peak/low auditory & haptic cues, and concise speech generation
 * for accessible auditory charts.
 *
 * REUSES EarconManager's shared AudioContext, HapticManager, and SpeechEngine.
 */
export class SonificationEngine {
  public static readonly DEFAULT_MIN_FREQUENCY = 250;
  public static readonly DEFAULT_MAX_FREQUENCY = 900;

  /**
   * Normalizes a data value to an audio frequency:
   * normalized = (value - minValue) / (maxValue - minValue)
   * frequency = MIN_FREQUENCY + normalized * (MAX_FREQUENCY - MIN_FREQUENCY)
   */
  public static calculateFrequency(
    value: number,
    minValue: number,
    maxValue: number,
    minFrequency = SonificationEngine.DEFAULT_MIN_FREQUENCY,
    maxFrequency = SonificationEngine.DEFAULT_MAX_FREQUENCY
  ): number {
    if (maxValue === minValue) {
      return (minFrequency + maxFrequency) / 2;
    }
    const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    return Math.round(minFrequency + normalized * (maxFrequency - minFrequency));
  }

  /**
   * Calculates stereo pan position between -1.0 (far left) and +1.0 (far right)
   * for bar and line charts. For pie charts or single points, stays centered (0.0).
   */
  public static calculatePan(index: number, totalPoints: number, graphType: string): number {
    if (graphType === 'pie' || totalPoints <= 1) {
      return 0.0;
    }
    // Map index 0 -> -1.0 and index (total - 1) -> +1.0
    const ratio = index / (totalPoints - 1);
    return Math.max(-1.0, Math.min(1.0, -1.0 + ratio * 2.0));
  }

  /**
   * Computes graph min, max, points, and summary metrics.
   */
  public static computeStats(data: GraphDataPoint[]): GraphStats {
    if (!data || data.length === 0) {
      return {
        min: 0,
        max: 0,
        minPoint: null,
        maxPoint: null,
        totalPoints: 0,
        sum: 0,
        average: 0,
      };
    }

    let min = data[0].value;
    let max = data[0].value;
    let minPoint = data[0];
    let maxPoint = data[0];
    let sum = 0;

    for (const pt of data) {
      sum += pt.value;
      if (pt.value < min) {
        min = pt.value;
        minPoint = pt;
      }
      if (pt.value > max) {
        max = pt.value;
        maxPoint = pt;
      }
    }

    return {
      min,
      max,
      minPoint,
      maxPoint,
      totalPoints: data.length,
      sum,
      average: Math.round((sum / data.length) * 100) / 100,
    };
  }

  /**
   * Analyzes trend between the current point and the previous point.
   */
  public static analyzeTrend(
    data: GraphDataPoint[],
    currentIndex: number,
    unit = ''
  ): TrendAnalysisResult {
    if (currentIndex <= 0 || !data[currentIndex] || !data[currentIndex - 1]) {
      return {
        direction: 'UNCHANGED',
        verbal: 'Starting data point. No prior trend.',
        diff: 0,
      };
    }

    const current = data[currentIndex];
    const prev = data[currentIndex - 1];
    const diff = current.value - prev.value;
    const unitSuffix = unit ? ` ${unit}` : '';

    if (diff > 0) {
      return {
        direction: 'RISING',
        verbal: `${current.label}. Increased by ${diff}${unitSuffix} from previous point (${prev.label}).`,
        diff,
      };
    }
    if (diff < 0) {
      return {
        direction: 'FALLING',
        verbal: `${current.label}. Decreased by ${Math.abs(diff)}${unitSuffix} from previous point (${prev.label}).`,
        diff,
      };
    }
    return {
      direction: 'UNCHANGED',
      verbal: `${current.label}. Unchanged from previous point (${prev.label}).`,
      diff: 0,
    };
  }

  /**
   * Generates a dynamic, accessible graph summary:
   * "Graph contains 5 data points. Highest value is 90 in 2022. Lowest value is 40 in 2020."
   */
  public static generateSummary(graph: QuestionGraph): string {
    const { data, title, unit } = graph;
    if (!data || data.length === 0) {
      return 'Graph is empty with no data points.';
    }

    const stats = this.computeStats(data);
    const unitText = unit ? ` ${unit}` : '';
    const titleText = title ? `${title}. ` : '';

    let summary = `${titleText}Graph contains ${stats.totalPoints} data points. `;
    if (stats.maxPoint) {
      summary += `Highest value is ${stats.maxPoint.value}${unitText} in ${stats.maxPoint.label}. `;
    }
    if (stats.minPoint) {
      summary += `Lowest value is ${stats.minPoint.value}${unitText} in ${stats.minPoint.label}. `;
    }

    // Overall directional narrative if >= 3 points
    if (data.length >= 3) {
      const first = data[0];
      const last = data[data.length - 1];
      if (last.value > first.value) {
        summary += `Overall trajectory ascends from ${first.value} to ${last.value}.`;
      } else if (last.value < first.value) {
        summary += `Overall trajectory descends from ${first.value} to ${last.value}.`;
      } else {
        summary += `Overall trajectory starts and ends at ${first.value}.`;
      }
    }

    return summary.trim();
  }

  /**
   * Synthesizes and plays a single sonification data point tone using Web Audio API.
   * Leverages StereoPannerNode when available, falling back cleanly to centered.
   */
  public static playPointTone(
    graph: QuestionGraph,
    index: number,
    duration = 0.25
  ): { frequency: number; pan: number } | null {
    if (!graph.sonification?.enabled || !graph.data || graph.data.length === 0) {
      return null;
    }

    const point = graph.data[index];
    if (!point) return null;

    const stats = this.computeStats(graph.data);
    const minFreq = graph.sonification.minFrequency ?? SonificationEngine.DEFAULT_MIN_FREQUENCY;
    const maxFreq = graph.sonification.maxFrequency ?? SonificationEngine.DEFAULT_MAX_FREQUENCY;
    const frequency = this.calculateFrequency(point.value, stats.min, stats.max, minFreq, maxFreq);

    const pan = graph.sonification.spatialAudio
      ? this.calculatePan(index, graph.data.length, graph.type)
      : 0.0;

    const ctx = earconManager.getAudioContext();
    if (!ctx) return { frequency, pan };

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Instrument timbre: Sine with warm decay
      osc.type = graph.type === 'pie' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);

      // Stereo panning connection (with fallback if StereoPanner is not supported)
      if (typeof ctx.createStereoPanner === 'function' && graph.sonification.spatialAudio) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration);

      // Trigger optional peak / dip detection cues
      if (graph.sonification.peakDetection) {
        if (point.value === stats.max && stats.max !== stats.min) {
          setTimeout(() => {
            earconManager.playEarcon('SUCCESS', { gainMultiplier: 0.3 });
            if (graph.sonification.haptic) hapticManager.vibratePeak();
          }, duration * 600);
        } else if (point.value === stats.min && stats.max !== stats.min) {
          setTimeout(() => {
            earconManager.playEarcon('WARNING', { gainMultiplier: 0.2 });
            if (graph.sonification.haptic) hapticManager.vibrateLow();
          }, duration * 600);
        } else if (graph.sonification.haptic) {
          hapticManager.vibrateGraphPoint();
        }
      } else if (graph.sonification.haptic) {
        hapticManager.vibrateGraphPoint();
      }

      return { frequency, pan };
    } catch (e) {
      console.warn('[dristix:sonification] playPointTone failed:', e);
      return { frequency, pan };
    }
  }

  /**
   * Plays a guided step-by-step audio tour of all graph points.
   * Plays each point's pitch tone, highlights the point, and speaks its label and value with comfortable spacing.
   */
  public static playGuidedTour(
    graph: QuestionGraph,
    onPoint?: (index: number) => void,
    onComplete?: () => void
  ): { cancel: () => void } {
    let isCancelled = false;
    let currentTimeout: any = null;
    let unsubscribeSpeech: (() => void) | null = null;

    if (!graph.data || graph.data.length === 0) {
      if (onComplete) onComplete();
      return { cancel: () => {} };
    }

    const data = graph.data;
    const stats = this.computeStats(data);
    const unit = graph.unit ? ` ${graph.unit}` : '';
    let idx = 0;

    const cleanup = () => {
      isCancelled = true;
      if (currentTimeout) clearTimeout(currentTimeout);
      if (unsubscribeSpeech) {
        unsubscribeSpeech();
        unsubscribeSpeech = null;
      }
      speechEngine.stop(false);
    };

    const playNext = () => {
      if (isCancelled) return;
      if (idx >= data.length) {
        // Finished all points
        currentTimeout = setTimeout(() => {
          if (isCancelled) return;
          const conclusion = `Guided tour completed for ${graph.title || 'graph'}. Highest was ${stats.maxPoint?.value ?? ''}${unit} in ${stats.maxPoint?.label ?? ''}. Press Left and Right arrow keys to explore points manually.`;
          speechEngine.speak(conclusion, true);
          if (onComplete) onComplete();
        }, 400);
        return;
      }

      const pointIdx = idx;
      const point = data[pointIdx];
      idx++;

      if (onPoint) onPoint(pointIdx);
      // Play warm 400ms tone with spatial stereo panning
      SonificationEngine.playPointTone(graph, pointIdx, 0.4);

      // Brief delay so candidate clearly hears the tone first, then speech
      currentTimeout = setTimeout(() => {
        if (isCancelled) return;
        let peakText = '';
        if (point.value === stats.max && stats.max !== stats.min) peakText = ', Highest value';
        else if (point.value === stats.min && stats.max !== stats.min) peakText = ', Lowest value';

        const spokenText = `${point.label}: ${point.value}${unit}${peakText}.`;
        speechEngine.speak(spokenText, true);

        // After this speech finishes, advance to next point with a polite 600ms breath pause
        unsubscribeSpeech = speechEngine.onSpeechEnd(() => {
          if (unsubscribeSpeech) {
            unsubscribeSpeech();
            unsubscribeSpeech = null;
          }
          if (isCancelled) return;
          currentTimeout = setTimeout(playNext, 600);
        });
      }, 420);
    };

    // Start with a brief intro announcement, then begin tour
    const intro = `Starting guided audio tour of ${graph.title || 'data chart'}. ${data.length} data points.`;
    speechEngine.speak(intro, true);

    unsubscribeSpeech = speechEngine.onSpeechEnd(() => {
      if (unsubscribeSpeech) {
        unsubscribeSpeech();
        unsubscribeSpeech = null;
      }
      if (isCancelled) return;
      currentTimeout = setTimeout(playNext, 400);
    });

    return { cancel: cleanup };
  }

  /**
   * Plays a sweep through all data points sequentially (auditory pitch sweep).
   * Paced at comfortable ~0.42s per point so the human ear can clearly discern trajectories.
   */
  public static playOverviewSweep(
    graph: QuestionGraph,
    pointDuration = 0.42,
    onPoint?: (index: number) => void,
    onComplete?: () => void
  ): { cancel: () => void } {
    let isCancelled = false;
    const timers: number[] = [];

    if (!graph.data || graph.data.length === 0) {
      return { cancel: () => {} };
    }

    graph.data.forEach((_, i) => {
      const timer = window.setTimeout(() => {
        if (isCancelled) return;
        SonificationEngine.playPointTone(graph, i, pointDuration);
        if (onPoint) onPoint(i);
        if (i === graph.data.length - 1 && onComplete) {
          window.setTimeout(onComplete, pointDuration * 1000);
        }
      }, i * pointDuration * 1000);
      timers.push(timer);
    });

    return {
      cancel: () => {
        isCancelled = true;
        timers.forEach((t) => clearTimeout(t));
      },
    };
  }

  /**
   * Concise speech output for point navigation without overwhelming the candidate.
   * e.g. "2022. Sales 90 Crore."
   */
  public static announcePoint(
    graph: QuestionGraph,
    index: number,
    detail: 'minimal' | 'standard' | 'detailed' = 'standard'
  ): void {
    const point = graph.data[index];
    if (!point) return;

    const unit = graph.unit ? ` ${graph.unit}` : '';
    const yAxis = graph.yAxisLabel ? ` ${graph.yAxisLabel}` : '';

    if (detail === 'minimal') {
      speechEngine.speak(`${point.label}: ${point.value}${unit}`, true);
      return;
    }

    if (detail === 'detailed') {
      const stats = this.computeStats(graph.data);
      let qualifier = '';
      if (point.value === stats.max) qualifier = ' (Maximum point)';
      if (point.value === stats.min) qualifier = ' (Minimum point)';
      const trend = this.analyzeTrend(graph.data, index, graph.unit);
      speechEngine.speak(
        `Point ${index + 1} of ${graph.data.length}. ${point.label}.${yAxis} is ${point.value}${unit}${qualifier}. ${index > 0 ? trend.verbal : ''}`,
        true
      );
      return;
    }

    // Standard concise mode
    speechEngine.speak(`${point.label}.${yAxis} ${point.value}${unit}.`, true);
  }
}
