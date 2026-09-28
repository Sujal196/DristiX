import type { AiDiagramExplanation } from '../../shared/types';

export interface TriangleSpec {
  type: 'triangle';
  vertexTop: string; // e.g. "C"
  vertexLeft: string; // e.g. "A"
  vertexRight: string; // e.g. "B"
  baseLabel: string; // e.g. "5.8 cm"
  angleLeftLabel?: string; // e.g. "60°"
  angleRightLabel?: string; // e.g. "30°"
  angleTopLabel?: string; // e.g. "90°"
  sideLeftLabel?: string; // e.g. "a"
  sideRightLabel?: string; // e.g. "b"
  isRightAngle?: boolean;
}

export interface CircleSpec {
  type: 'circle';
  centerLabel: string; // e.g. "O"
  radiusLabel?: string; // e.g. "r = 7 cm"
  chordLabel?: string; // e.g. "AB = 10 cm"
  showTangent?: boolean;
}

export interface MotionSpec {
  type: 'motion';
  object1Label: string; // e.g. "Train (L metres)"
  object2Label: string; // e.g. "Platform (250 m)"
  speedLabel: string; // e.g. "v = 72 km/h"
  timeLabel: string; // e.g. "t = 26 seconds"
}

export type GeometryPreset = TriangleSpec | CircleSpec | MotionSpec;

/**
 * Renders a crisp vector SVG string for a given Geometry/Diagram preset.
 */
export function renderGeometrySvg(spec: GeometryPreset): string {
  if (spec.type === 'triangle') {
    const {
      vertexTop = 'C',
      vertexLeft = 'A',
      vertexRight = 'B',
      baseLabel = '5.8 cm',
      angleLeftLabel = '60°',
      angleRightLabel = '30°',
      angleTopLabel = '',
      sideLeftLabel = '',
      sideRightLabel = '',
      isRightAngle = false,
    } = spec;

    // SVG Coordinates for a clean acute/right triangle:
    // Left A (80, 220), Right B (320, 220), Top C (180, 60)
    const topX = isRightAngle ? 80 : 180;
    const topY = 60;
    const leftX = 80;
    const leftY = 220;
    const rightX = 320;
    const rightY = 220;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="100%" height="100%">
        <rect width="400" height="280" fill="#ffffff" rx="16"/>
        <g stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Triangle Lines -->
          <polygon points="${leftX},${leftY} ${rightX},${rightY} ${topX},${topY}" fill="none"/>

          <!-- Angle Arc Left (Angle A) -->
          ${angleLeftLabel ? `<path d="M 120 220 A 40 40 0 0 0 105 185" stroke="#2563eb" stroke-width="2"/>` : ''}

          <!-- Angle Arc Right (Angle B) -->
          ${angleRightLabel ? `<path d="M 280 220 A 40 40 0 0 1 295 185" stroke="#2563eb" stroke-width="2"/>` : ''}

          <!-- Right Angle Marker if applicable -->
          ${isRightAngle ? `<path d="M 80 200 L 100 200 L 100 220" stroke="#dc2626" stroke-width="2"/>` : ''}
        </g>

        <!-- Labels & Text -->
        <g fill="#0f172a" font-family="system-ui, sans-serif" font-weight="bold">
          <!-- Vertices -->
          <text x="${leftX - 15}" y="${leftY + 20}" font-size="20" text-anchor="end">${vertexLeft}</text>
          <text x="${rightX + 15}" y="${rightY + 20}" font-size="20" text-anchor="start">${vertexRight}</text>
          <text x="${topX}" y="${topY - 15}" font-size="20" text-anchor="middle">${vertexTop}</text>

          <!-- Base Label -->
          <text x="${(leftX + rightX) / 2}" y="${leftY + 30}" font-size="16" text-anchor="middle" fill="#1e293b">${baseLabel}</text>

          <!-- Angle Labels -->
          ${angleLeftLabel ? `<text x="130" y="210" font-size="15" fill="#1d4ed8">${angleLeftLabel}</text>` : ''}
          ${angleRightLabel ? `<text x="260" y="210" font-size="15" fill="#1d4ed8">${angleRightLabel}</text>` : ''}
          ${angleTopLabel ? `<text x="${topX}" y="${topY + 35}" font-size="15" fill="#1d4ed8">${angleTopLabel}</text>` : ''}

          <!-- Side Labels -->
          ${sideLeftLabel ? `<text x="${(leftX + topX) / 2 - 20}" y="${(leftY + topY) / 2}" font-size="15">${sideLeftLabel}</text>` : ''}
          ${sideRightLabel ? `<text x="${(rightX + topX) / 2 + 20}" y="${(rightY + topY) / 2}" font-size="15">${sideRightLabel}</text>` : ''}
        </g>
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  if (spec.type === 'circle') {
    const { centerLabel = 'O', radiusLabel = 'r = 7 cm', chordLabel = 'AB = 10 cm' } = spec;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="100%" height="100%">
        <rect width="400" height="280" fill="#ffffff" rx="16"/>
        <!-- Circle -->
        <circle cx="200" cy="140" r="90" stroke="#0f172a" stroke-width="3" fill="none"/>

        <!-- Center O -->
        <circle cx="200" cy="140" r="4" fill="#dc2626"/>
        <text x="200" y="130" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">${centerLabel}</text>

        <!-- Radius Line -->
        <line x1="200" y1="140" x2="290" y2="140" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="4"/>
        <text x="245" y="132" font-size="14" font-weight="bold" fill="#2563eb" text-anchor="middle">${radiusLabel}</text>

        <!-- Chord Line AB -->
        <line x1="130" y1="200" x2="270" y2="200" stroke="#16a34a" stroke-width="3"/>
        <circle cx="130" cy="200" r="4" fill="#16a34a"/>
        <circle cx="270" cy="200" r="4" fill="#16a34a"/>
        <text x="115" y="215" font-size="16" font-weight="bold" fill="#0f172a">A</text>
        <text x="280" y="215" font-size="16" font-weight="bold" fill="#0f172a">B</text>
        <text x="200" y="225" font-size="14" font-weight="bold" fill="#15803d" text-anchor="middle">${chordLabel}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Fallback Motion Spec
  const { object1Label, object2Label, speedLabel, timeLabel } = spec as MotionSpec;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" width="100%" height="100%">
      <rect width="500" height="200" fill="#0f172a" rx="14"/>
      <line x1="40" y1="140" x2="460" y2="140" stroke="#475569" stroke-width="4"/>
      <rect x="60" y="80" width="160" height="45" fill="#3b82f6" rx="6"/>
      <text x="140" y="108" fill="white" font-size="14" font-weight="bold" text-anchor="middle">${object1Label}</text>
      <text x="140" y="70" fill="#60a5fa" font-size="13" font-weight="bold" text-anchor="middle">${speedLabel}</text>
      <rect x="230" y="95" width="210" height="30" fill="#10b981" rx="4"/>
      <text x="335" y="115" fill="white" font-size="13" font-weight="bold" text-anchor="middle">${object2Label}</text>
      <line x1="60" y1="160" x2="440" y2="160" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4"/>
      <text x="250" y="180" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">Distance Traversed (${timeLabel})</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates natural spoken text for TTS voice engines for any geometry spec.
 */
export function verbalizeGeometryDiagram(spec: GeometryPreset): {
  description: string;
  audioNarration: string;
  aiExplanation: AiDiagramExplanation;
} {
  if (spec.type === 'triangle') {
    const { vertexTop, vertexLeft, vertexRight, baseLabel, angleLeftLabel, angleRightLabel, angleTopLabel } = spec;

    const description = `Triangle ${vertexLeft}${vertexRight}${vertexTop} with base ${vertexLeft}${vertexRight} = ${baseLabel}, Angle ${vertexLeft} = ${angleLeftLabel || 'N/A'}, Angle ${vertexRight} = ${angleRightLabel || 'N/A'}`;

    const audioNarration = `Visual geometry diagram: Triangle ${vertexLeft} ${vertexRight} ${vertexTop}. Base side ${vertexLeft} ${vertexRight} measures ${baseLabel}. Interior angle ${vertexLeft} is ${angleLeftLabel || 'unspecified'}. Interior angle ${vertexRight} is ${angleRightLabel || 'unspecified'}. Vertex ${vertexTop} is situated at the top opposite to base ${vertexLeft} ${vertexRight}.`;

    const aiExplanation: AiDiagramExplanation = {
      visualBreakdown: [
        `Triangle Vertices: ${vertexLeft} (bottom-left), ${vertexRight} (bottom-right), ${vertexTop} (top).`,
        `Base Side (${vertexLeft}${vertexRight}): Length ${baseLabel}.`,
        `Interior Angles: Angle ${vertexLeft} = ${angleLeftLabel || 'N/A'}, Angle ${vertexRight} = ${angleRightLabel || 'N/A'}${angleTopLabel ? `, Angle ${vertexTop} = ${angleTopLabel}` : ''}.`,
      ],
      educationalContext: `This geometric diagram defines triangle ${vertexLeft}${vertexRight}${vertexTop}. You can solve for missing angles or side lengths using the Angle Sum Property (Sum of interior angles = 180 degrees) or Sine/Cosine Rules.`,
      keyPoints: [
        `Base length ${vertexLeft}${vertexRight} = ${baseLabel}`,
        `Angle ${vertexLeft} = ${angleLeftLabel || 'N/A'}, Angle ${vertexRight} = ${angleRightLabel || 'N/A'}`,
        `Sum of interior angles = 180 degrees`,
      ],
      audioNarration,
    };

    return { description, audioNarration, aiExplanation };
  }

  if (spec.type === 'circle') {
    const { centerLabel, radiusLabel, chordLabel } = spec;
    const description = `Circle with Center ${centerLabel}, ${radiusLabel || ''}, ${chordLabel || ''}`;
    const audioNarration = `Visual geometry diagram: Circle with center point ${centerLabel}. ${radiusLabel ? `Radius line measures ${radiusLabel}.` : ''} ${chordLabel ? `Chord line A B measures ${chordLabel}.` : ''}`;

    const aiExplanation: AiDiagramExplanation = {
      visualBreakdown: [
        `Circle Center: Point ${centerLabel}.`,
        `Radius: ${radiusLabel || 'N/A'}.`,
        `Chord: ${chordLabel || 'N/A'}.`,
      ],
      educationalContext: `The diagram illustrates a circle centered at ${centerLabel}. Use circle theorems (e.g. perpendicular from center bisects chord, radius-tangent perpendicularity) to solve.`,
      keyPoints: [
        `Center at ${centerLabel}`,
        `${radiusLabel || 'Radius indicated'}`,
        `${chordLabel || 'Chord indicated'}`,
      ],
      audioNarration,
    };

    return { description, audioNarration, aiExplanation };
  }

  // Motion fallback
  const { object1Label, object2Label, speedLabel, timeLabel } = spec as MotionSpec;
  const description = `Motion diagram: ${object1Label} moving at ${speedLabel} past ${object2Label} in ${timeLabel}.`;
  const audioNarration = `Visual motion diagram: ${object1Label} traveling at ${speedLabel} passing ${object2Label} in time ${timeLabel}.`;

  const aiExplanation: AiDiagramExplanation = {
    visualBreakdown: [
      `Object 1: ${object1Label} at ${speedLabel}.`,
      `Object 2: ${object2Label}.`,
      `Time Duration: ${timeLabel}.`,
    ],
    educationalContext: `Use relative motion and speed-distance-time formulas (Distance = Speed * Time) to solve for unknown length or speed.`,
    keyPoints: [`Speed: ${speedLabel}`, `Time: ${timeLabel}`, `Distance = Speed * Time`],
    audioNarration,
  };

  return { description, audioNarration, aiExplanation };
}
