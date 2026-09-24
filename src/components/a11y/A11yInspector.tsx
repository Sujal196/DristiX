import React, { useState } from 'react';
import axe, { AxeResults } from 'axe-core';
import { ShieldCheck, AlertCircle, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';

export const A11yInspector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [auditResults, setAuditResults] = useState<AxeResults | null>(null);

  const runAudit = async () => {
    setIsScanning(true);
    useAnnouncerStore.getState().announce('Running WCAG 2.1 Level AA accessibility scan with axe-core...', 'polite');

    try {
      const results = await axe.run(document.body, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      });
      setAuditResults(results);

      const violationCount = results.violations.length;
      const passedCount = results.passes.length;
      useAnnouncerStore
        .getState()
        .announce(
          `Accessibility scan completed. ${passedCount} rules passed. ${violationCount} violations found.`,
          'assertive'
        );
    } catch {
      useAnnouncerStore.getState().announce('Accessibility scan could not be completed.', 'assertive');
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!auditResults) {
      runAudit();
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating A11y Badge Trigger */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Open WCAG 2.1 AA Accessibility Inspector (Powered by axe-core)"
          className="px-3 py-2 rounded-full border-2 border-theme-border bg-theme-surface text-theme-text hover:bg-theme-bg shadow-xl flex items-center gap-1.5 font-bold text-xs transition ring-2 ring-theme-focus-ring/40"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          <span>a11y Audit</span>
          {auditResults && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                auditResults.violations.length === 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              {auditResults.violations.length === 0 ? 'Pass' : `${auditResults.violations.length} Fail`}
            </span>
          )}
        </button>
      </div>

      {/* Inspector Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-2xl max-h-[85vh] bg-theme-surface border-2 border-theme-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-theme-text">
            <div className="p-4 border-b-2 border-theme-border flex justify-between items-center bg-theme-bg">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" aria-hidden="true" />
                <div>
                  <h2 id="inspector-title" className="text-lg font-bold">
                    WCAG 2.1 AA Live Inspector (axe-core)
                  </h2>
                  <p className="text-xs text-theme-text-secondary">
                    Real-time automated DOM accessibility validation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runAudit}
                  disabled={isScanning}
                  aria-label="Rerun accessibility audit"
                  className="p-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-text disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close accessibility inspector"
                  className="p-2 rounded-lg border border-theme-border hover:bg-theme-surface"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {isScanning && (
                <div className="p-6 text-center space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-theme-focus-ring" aria-hidden="true" />
                  <p className="font-semibold text-sm">Auditing DOM with axe-core engine...</p>
                </div>
              )}

              {!isScanning && auditResults && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-bold">
                    <div className="p-3 rounded-lg border-2 border-emerald-600 bg-emerald-500/10 text-emerald-600">
                      <span className="block text-xl font-black">{auditResults.passes.length}</span>
                      <span>Passed Rules</span>
                    </div>
                    <div className="p-3 rounded-lg border-2 border-theme-border bg-theme-bg">
                      <span className="block text-xl font-black">{auditResults.passes.length + auditResults.violations.length}</span>
                      <span>Tested Rules</span>
                    </div>
                    <div
                      className={`p-3 rounded-lg border-2 ${
                        auditResults.violations.length === 0
                          ? 'border-emerald-600 bg-emerald-500/10 text-emerald-600'
                          : 'border-red-600 bg-red-500/10 text-red-600'
                      }`}
                    >
                      <span className="block text-xl font-black">{auditResults.violations.length}</span>
                      <span>Violations</span>
                    </div>
                  </div>

                  {auditResults.violations.length === 0 ? (
                    <div className="p-4 rounded-lg border-2 border-emerald-600 bg-emerald-500/10 text-emerald-600 flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <strong className="block text-base font-bold">
                          Zero WCAG 2.1 AA Violations Detected!
                        </strong>
                        <p className="text-xs text-theme-text mt-1 leading-relaxed">
                          All tested criteria for color contrast, semantic form labels, accessible landmark roles, heading levels, and keyboard focus indicators passed automated axe-core scrutiny.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-red-500 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" aria-hidden="true" />
                        <span>Violations to address ({auditResults.violations.length}):</span>
                      </h3>
                      {auditResults.violations.map((v) => (
                        <div key={v.id} className="p-3 rounded border border-red-500 bg-red-500/10 text-xs space-y-1">
                          <strong className="block font-bold">{v.help} ({v.id})</strong>
                          <p className="text-theme-text-secondary">{v.description}</p>
                          <span className="text-[10px] font-mono block text-red-400">Impact: {v.impact}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sample Passed Checks */}
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-theme-text-secondary mb-2">
                      Verified Criteria Sample ({auditResults.passes.length}):
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                      {auditResults.passes.slice(0, 15).map((p) => (
                        <div key={p.id} className="p-2 rounded bg-theme-bg border border-theme-border flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.help}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-3 border-t border-theme-border bg-theme-bg flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 font-bold rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-bg text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
