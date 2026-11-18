export interface InviteHandlerDependencies {
  adminClient: any | null;
  anonClient: any | null;
  supabaseEnvConfigured: boolean;
  appUrl?: string;
}

export interface InviteHandlerInput {
  authHeader?: string;
  body: Record<string, any>;
  deps: InviteHandlerDependencies;
}

export interface InviteHandlerResult {
  statusCode: number;
  body: Record<string, any>;
}

export async function processAdminInviteRequest({
  authHeader,
  body,
  deps,
}: InviteHandlerInput): Promise<InviteHandlerResult> {
  const {
    email,
    role = 'lab_assistant',
    institutionId,
    name,
    identifier,
    departmentId,
    assignedLabIds,
  } = body || {};

  // Bound and type-check data before using it in Auth or database operations.
  const bounded = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  if (!bounded(email, 254) || !bounded(name, 120) || !bounded(identifier, 64)
    || (institutionId != null && !bounded(institutionId, 64))
    || (departmentId != null && departmentId !== '' && !bounded(departmentId, 64))
    || (assignedLabIds != null && (!Array.isArray(assignedLabIds) || assignedLabIds.length > 100 || assignedLabIds.some((id: unknown) => !bounded(id, 64))))) {
    return { statusCode: 400, body: { error: 'Invalid invitation fields or field length.' } };
  }

  // 1. Validate required fields
  if (!email || !name || !identifier) {
    return {
      statusCode: 400,
      body: {
        error: 'Missing required invitation parameters: email, name, identifier.',
      },
    };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();
  const cleanIdentifier = String(identifier).trim().toUpperCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return {
      statusCode: 400,
      body: { error: 'Invalid email address format.' },
    };
  }

  // Strict MVIT role guard: only Lab Assistant invitations are allowed
  if (role !== 'lab_assistant') {
    return {
      statusCode: 400,
      body: {
        error: 'Forbidden role assignment. College Admin may only invite Lab Assistant accounts.',
      },
    };
  }

  const { adminClient, anonClient, supabaseEnvConfigured } = deps;

  // Never fall back to demo_local when Supabase environment variables are present
  if (supabaseEnvConfigured && (!adminClient || !anonClient)) {
    return {
      statusCode: 503,
      body: {
        error:
          'Live Supabase environment detected, but SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY is missing on the server. Cannot dispatch staff invitations.',
      },
    };
  }

  if (adminClient && anonClient) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: {
          error:
            'Unauthorized: Authentication required. Please provide a valid Supabase Bearer token.',
        },
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: authUserData, error: authUserErr } = await adminClient.auth.getUser(token);
    if (authUserErr || !authUserData?.user) {
      return {
        statusCode: 401,
        body: {
          error: 'Unauthorized: Invalid or expired Supabase authentication session.',
        },
      };
    }

    const callerUserId = authUserData.user.id;
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', callerUserId)
      .single();

    if (profileErr || !callerProfile) {
      return {
        statusCode: 403,
        body: {
          error: 'Forbidden: Caller profile was not found in MVIT database records.',
        },
      };
    }

    if (callerProfile.status === 'suspended') {
      return {
        statusCode: 403,
        body: {
          error: 'Forbidden: Your account has been suspended by MVIT administration.',
        },
      };
    }

    if (callerProfile.status !== 'active') {
      return {
        statusCode: 403,
        body: {
          error: 'Forbidden: Only active MVIT College Administrator accounts may invite staff.',
        },
      };
    }

    if (callerProfile.role !== 'college_admin') {
      return {
        statusCode: 403,
        body: {
          error:
            'Forbidden: Only MVIT College Administrators may invite or create Lab Assistant accounts.',
        },
      };
    }

    // Resolve canonical MVIT institution UUID directly from database
    const { data: mvitInst, error: instErr } = await adminClient
      .from('institutions')
      .select('id, code, active')
      .ilike('code', 'MVIT')
      .eq('active', true)
      .single();

    if (instErr || !mvitInst?.id) {
      return {
        statusCode: 500,
        body: {
          error:
            'Canonical active MVIT institution record was not found in Supabase institutions table.',
        },
      };
    }

    if (callerProfile.institution_id !== mvitInst.id) {
      return {
        statusCode: 403,
        body: {
          error:
            'Forbidden: Caller profile does not belong to Manakula Vinayagar Institute of Technology.',
        },
      };
    }

    if (institutionId && institutionId !== mvitInst.id) {
      return {
        statusCode: 403,
        body: {
          error:
            'Forbidden: Invitations must target the canonical Manakula Vinayagar Institute of Technology institution.',
        },
      };
    }

    const targetInstId: string = mvitInst.id;

    // Validate department belongs to MVIT if provided
    if (departmentId) {
      const { data: deptRow, error: deptErr } = await adminClient
        .from('departments')
        .select('id')
        .eq('id', departmentId)
        .eq('institution_id', targetInstId)
        .single();

      if (deptErr || !deptRow) {
        return {
          statusCode: 400,
          body: { error: 'Selected department does not belong to MVIT.' },
        };
      }
    }

    // Validate assigned labs belong to MVIT if provided
    const cleanLabIds: string[] = Array.isArray(assignedLabIds)
      ? Array.from(new Set(assignedLabIds.filter((id: any) => typeof id === 'string' && id.trim())))
      : [];

    let validatedLabs: Array<{ id: string; primary_assistant_id?: string | null }> = [];
    if (cleanLabIds.length > 0) {
      const { data: labRows, error: labErr } = await adminClient
        .from('labs')
        .select('id, primary_assistant_id')
        .eq('institution_id', targetInstId)
        .in('id', cleanLabIds);

      if (labErr || !labRows || labRows.length !== cleanLabIds.length) {
        return {
          statusCode: 400,
          body: { error: 'One or more selected laboratories do not belong to MVIT.' },
        };
      }
      validatedLabs = labRows;
    }

    // Count only authenticated, authorized and validated invitations. Fail closed
    // if the shared counter cannot be reached; never fall back to per-instance state.
    const { data: allowed, error: limitError } = await adminClient.rpc('consume_staff_invitation_rate_limit', { p_subject: callerUserId });
    if (limitError || typeof allowed !== 'boolean') {
      return { statusCode: 503, body: { error: 'Staff invitations are temporarily unavailable.' } };
    }
    if (!allowed) return { statusCode: 429, body: { error: 'Too many invitations. Try again in one minute.' } };

    const appUrl = deps.appUrl || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/update-password`;

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: {
          name: cleanName,
          role: 'lab_assistant',
          institution_id: targetInstId,
          identifier: cleanIdentifier,
        },
        redirectTo: redirectUrl,
      }
    );

    if (inviteErr || !inviteData?.user) {
      return {
        statusCode: 400,
        body: {
          error: 'Unable to send this invitation. Check the address or contact your administrator.',
        },
      };
    }

    const newAuthUserId = inviteData.user.id;
    const nowIso = new Date().toISOString();

    const { error: profileUpsertErr } = await adminClient.from('profiles').upsert(
      {
        id: newAuthUserId,
        institution_id: targetInstId,
        role: 'lab_assistant',
        name: cleanName,
        email: cleanEmail,
        identifier: cleanIdentifier,
        department_id: departmentId || null,
        status: 'invited',
        invited_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );

    if (profileUpsertErr) {
      return {
        statusCode: 500,
        body: {
          error: 'Invitation sent, but profile setup is incomplete. Contact your administrator.',
        },
      };
    }

    if (cleanLabIds.length > 0) {
      const labAssignments = cleanLabIds.map((labId: string) => ({
        institution_id: targetInstId,
        profile_id: newAuthUserId,
        lab_id: labId,
      }));

      const { error: assignErr } = await adminClient
        .from('profile_lab_assignments')
        .upsert(labAssignments, { onConflict: 'profile_id,lab_id' });

      if (assignErr) {
        return {
          statusCode: 500,
          body: {
            error: 'Profile created, but lab assignment is incomplete. Contact your administrator.',
          },
        };
      }

      const unassignedIds = validatedLabs
        .filter((l) => !l.primary_assistant_id)
        .map((l) => l.id);

      if (unassignedIds.length > 0) {
        const { error: labSyncErr } = await adminClient
          .from('labs')
          .update({ primary_assistant_id: newAuthUserId, updated_at: nowIso })
          .eq('institution_id', targetInstId)
          .in('id', unassignedIds);

        if (labSyncErr) {
          return {
            statusCode: 500,
            body: {
              error: 'Assignments saved, but primary assistant setup is incomplete. Contact your administrator.',
            },
          };
        }
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        userId: newAuthUserId,
        email: cleanEmail,
        role: 'lab_assistant',
        institutionId: targetInstId,
        status: 'invited',
        invitedAt: nowIso,
        message: `Official invitation email successfully dispatched to ${cleanEmail}`,
        source: 'supabase_production',
      },
    };
  }

  // Pure Demo Local Mode (only when no Supabase env configuration is present)
  return {
    statusCode: 200,
    body: {
      success: true,
      email: cleanEmail,
      role: 'lab_assistant',
      institutionId: 'inst-mvit',
      status: 'invited',
      invitedAt: new Date().toISOString(),
      message: `Lab Assistant account registered for ${cleanEmail} (Demo Local Mode)`,
      source: 'demo_local',
    },
  };
}

