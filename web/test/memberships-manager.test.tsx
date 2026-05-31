import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MembershipsManager from '../app/admin/[cid]/memberships/memberships-manager';

// The component calls useRouter().refresh() after mutations; stub it.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const roles = [
  { id: 'r-admin', name: 'Admin', templateKey: 'admin' },
  { id: 'r-night', name: 'Night Security', templateKey: null },
];
const blocks = [{ id: 'b-a', name: 'Block A' }];
const eligible = [{ id: 'u-eve', name: 'Eve Existing', email: 'eve@prestige.dev' }];
const memberships = [
  {
    id: 'm1',
    status: 'active',
    user: { id: 'u-nav', name: 'naveen paul', email: 'np@gmail.com' },
    roles: [
      {
        id: 'mr1',
        role: { id: 'r-night', name: 'Night Security', templateKey: null },
        block: null,
        unit: null,
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
];

function renderManager() {
  return render(
    <MembershipsManager
      communityId="c1"
      initialMemberships={memberships}
      roles={roles}
      blocks={blocks}
      initialEligibleUsers={eligible}
    />,
  );
}

beforeEach(() => {
  // any submit/refresh fetch resolves ok; opening drawers needs no network
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: async () => [] } as Response)),
  );
});

describe('Add member — single search-or-create flow', () => {
  it('lists existing tenant users, and falls through to "create new" on an unmatched email', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /\+ Add member/i }));
    const search = screen.getByPlaceholderText(/type a name/i);

    // existing eligible user is offered
    expect(screen.getByText('Eve Existing')).toBeInTheDocument();
    expect(screen.queryByText(/creating a new user/i)).not.toBeInTheDocument();

    // typing a brand-new email switches to create mode
    await user.type(search, 'newperson@prestige.dev');
    expect(screen.getByText(/creating a new user/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create user & add/i }),
    ).toBeInTheDocument();
    // the existing-user list is no longer shown
    expect(screen.queryByText('Eve Existing')).not.toBeInTheDocument();
  });

  it('selecting an existing user switches the CTA to "Add to community"', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /\+ Add member/i }));
    await user.type(screen.getByPlaceholderText(/type a name/i), 'Eve');
    await user.click(screen.getByText('Eve Existing'));

    expect(
      screen.getByRole('button', { name: /add to community/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create user & add/i }),
    ).not.toBeInTheDocument();
  });
});

describe('Grant role drawer — prefill + duplicate guard', () => {
  it('prefills the member current role and blocks re-granting it', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /\+ Grant role/i }));

    const roleSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(roleSelect.value).toBe('r-night'); // prefilled to current role

    const cta = screen.getByRole('button', { name: /already granted/i });
    expect(cta).toBeDisabled();
  });

  it('choosing a different role enables the grant', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /\+ Grant role/i }));
    await user.selectOptions(
      screen.getAllByRole('combobox')[0],
      'r-admin',
    );

    const cta = screen.getByRole('button', { name: /^grant role$/i });
    expect(cta).toBeEnabled();
  });
});
