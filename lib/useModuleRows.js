"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useModuleRows(caseId, moduleNumber) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("module_rows")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", moduleNumber)
      .order("row_order", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }, [caseId, moduleNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRow(initialData = {}) {
    const nextOrder = rows.length;
    const { data, error } = await supabase
      .from("module_rows")
      .insert([
        {
          case_id: caseId,
          module_number: moduleNumber,
          row_order: nextOrder,
          row_data: initialData,
        },
      ])
      .select()
      .single();
    if (!error) setRows((r) => [...r, data]);
    return { data, error };
  }

  async function updateRow(rowId, newData) {
    const { error } = await supabase
      .from("module_rows")
      .update({ row_data: newData, updated_at: new Date().toISOString() })
      .eq("id", rowId);
    if (!error) {
      setRows((r) =>
        r.map((row) => (row.id === rowId ? { ...row, row_data: newData } : row))
      );
    }
    return { error };
  }

  async function deleteRow(rowId) {
    const { error } = await supabase.from("module_rows").delete().eq("id", rowId);
    if (!error) setRows((r) => r.filter((row) => row.id !== rowId));
    return { error };
  }

  return { rows, loading, addRow, updateRow, deleteRow, reload: load };
}
