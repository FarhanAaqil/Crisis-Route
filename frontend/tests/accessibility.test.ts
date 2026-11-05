import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App';
import { Dashboard } from '../src/pages/Dashboard';
import { ObservationEditor } from '../src/components/ObservationEditor';
import { RoleGuard, ApproverOnlyGuard } from '../src/auth/guards';

describe('WCAG 2.1 AA Accessibility & Viewport Conformance', () => {
  it('renders application shell with WAI-ARIA compliant tablist and tabs', () => {
    const html = renderToString(React.createElement(App));

    // Tablist navigation container
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Main Navigation Tabs"');

    // Individual tabs
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="panel-dashboard"');
    expect(html).toContain('id="tab-dashboard"');

    // Active panel
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="panel-dashboard"');
    expect(html).toContain('aria-labelledby="tab-dashboard"');

    // Touch targets: min-height 44px on tabs
    expect(html).toContain('min-h-[44px]');
  });

  it('verifies mandatory operational safety invariant disclaimer is displayed prominently', () => {
    const html = renderToString(React.createElement(App));
    expect(html).toContain('Safety Invariant');
    expect(html).toContain(
      'CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety'
    );
  });

  it('ensures observation form controls have explicit ARIA labels and accessible targets', () => {
    const html = renderToString(
      React.createElement(ObservationEditor, {
        edgeId: 'EDGE-TEST-01',
        onSubmit: () => {},
      })
    );

    // Label associations and aria-labels
    expect(html).toContain('id="obs-status"');
    expect(html).toContain('aria-label="Observed road passability status"');
    expect(html).toContain('id="obs-source"');
    expect(html).toContain('aria-label="Observation reporting source"');
    expect(html).toContain('id="obs-credibility"');
    expect(html).toContain('aria-label="Source credibility weight slider"');
    expect(html).toContain('id="obs-water-depth"');
    expect(html).toContain('aria-label="Standing water depth in centimeters"');
    expect(html).toContain('id="obs-notes"');
    expect(html).toContain('aria-label="Field verification notes"');

    // Button touch target >= 44px
    expect(html).toContain('min-h-[44px]');
  });

  it('guarantees role guard provides accessible fallback messaging for unauthorized roles', () => {
    const analystHtml = renderToString(
      React.createElement(
        ApproverOnlyGuard,
        { currentRole: 'analyst' },
        React.createElement('button', null, 'Sign Off')
      )
    );
    expect(analystHtml).not.toContain('Sign Off');
    expect(analystHtml).toContain('Sign-Off Authorization Required');

    const approverHtml = renderToString(
      React.createElement(
        ApproverOnlyGuard,
        { currentRole: 'approver' },
        React.createElement('button', null, 'Sign Off')
      )
    );
    expect(approverHtml).toContain('Sign Off');
  });

  it('verifies Dashboard approver section has accessible form labels and rationale requirements', () => {
    const html = renderToString(
      React.createElement(Dashboard, { currentRole: 'approver' })
    );

    expect(html).toContain('id="approver-rationale"');
    expect(html).toContain('aria-label="Mandatory operational rationale and risk acceptance text"');
    expect(html).toContain('Approve &amp; Seal Relief Plan');
    expect(html).toContain('min-h-[44px]');
  });
});

