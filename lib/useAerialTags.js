"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useAerialTags(documentId) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!documentId) {
      setTags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("aerial_photo_tags")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    setTags(data || []);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTag({ caseId, x, y, width, height, facilityType, note }) {
    const { data, error } = await supabase
      .from("aerial_photo_tags")
      .insert([
        {
          case_id: caseId,
          document_id: documentId,
          x,
          y,
          width,
          height,
          facility_type: facilityType,
          note: note || null,
        },
      ])
      .select()
      .single();
    if (!error) setTags((t) => [...t, data]);
    return { data, error };
  }

  async function updateTag(tagId, fields) {
    const { error } = await supabase
      .from("aerial_photo_tags")
      .update(fields)
      .eq("id", tagId);
    if (!error) {
      setTags((t) =>
        t.map((tag) => (tag.id === tagId ? { ...tag, ...fields } : tag))
      );
    }
    return { error };
  }

  async function deleteTag(tagId) {
    const { error } = await supabase
      .from("aerial_photo_tags")
      .delete()
      .eq("id", tagId);
    if (!error) setTags((t) => t.filter((tag) => tag.id !== tagId));
    return { error };
  }

  return { tags, loading, addTag, updateTag, deleteTag, reload: load };
}
