import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

/**
 * Check if the current user's club has access to a specific app module.
 */
export function useModuleAccess(moduleKey: string) {
  const { session, clubId, plan } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id || !clubId) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    supabase
      .rpc("can_access_module", {
        _user_id: session.user.id,
        _club_id: clubId,
        _plan: plan ?? "trial",
        _module_key: moduleKey,
      })
      .then(({ data }) => {
        setHasAccess(data === true);
        setLoading(false);
      });
  }, [session?.user?.id, clubId, plan, moduleKey]);

  return { hasAccess, loading };
}
