import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "technician";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchRole = async (uid: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user?.email;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);

      if (error) {
        console.error("Error fetching role:", error);
      }
      if (!mounted) return;

      const roles = (data ?? []).map((r) => r.role as AppRole);
      let r: AppRole = roles.includes("admin") ? "admin" : roles.includes("manager") ? "manager" : "technician";
      
      // EMERGENCY HACK: Force admin for owner
      if (userEmail === 'welloliver1974@gmail.com') {
        r = 'admin';
      }
      
      setRole(r);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { setLoading(false); return; }
      setUserId(data.session.user.id);
      fetchRole(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setRole(null); setUserId(null); return; }
      setUserId(session.user.id);
      setTimeout(() => fetchRole(session.user.id), 0);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const isStaff = role === "admin" || role === "manager";
  return { role, userId, loading, isAdmin: role === "admin", isStaff, isTechnician: role === "technician" };
}
