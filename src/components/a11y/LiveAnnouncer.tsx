import React from 'react';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';

export const LiveAnnouncer: React.FC = () => {
  const politeMessage = useAnnouncerStore((s) => s.politeMessage);
  const assertiveMessage = useAnnouncerStore((s) => s.assertiveMessage);

  return (
    <>
      {/* Standard Polite Announcer matching Prompt Specification */}
      <div
        id="a11y-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      {/* High-priority Assertive Announcer for Urgent Milestones / Alerts */}
      <div
        id="a11y-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </>
  );
};
