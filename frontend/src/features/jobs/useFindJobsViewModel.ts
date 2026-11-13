// ViewModel: search job boards, open a job to read its AI summary, then apply.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { fetchHealth } from "@/features/health/api";
import { errorText } from "@/lib/apiClient";

import {
  addPastedJob,
  addToShortlist,
  getJobDetails,
  getShortlist,
  removeFromShortlist,
  saveJob,
  searchJobs,
  summarizeJob,
  type JobDetails,
  type JobListing,
  type JobSearchResult,
  type PastedJob,
} from "./api";

export type JobsTab = "results" | "shortlist";
const EMPTY_PASTE: PastedJob = { url: "", text: "", company: "", role: "" };

const SEARCH_KEY = "careerpilot.jobSearch";

interface SearchForm {
  q: string;
  location: string;
  graduate: boolean;
}

export interface FindJobsViewModel {
  form: SearchForm;
  submitted: (SearchForm & { page: number }) | null;
  result: JobSearchResult | null;
  isSearching: boolean;
  selectedId: string | null;
  details: JobDetails | null;
  isLoadingDetails: boolean;
  aiConfigured: boolean;
  isSummarizing: boolean;
  isSaving: boolean;
  error: string | null;
  tab: JobsTab;
  shortlist: JobListing[];
  paste: PastedJob;
  isPasting: boolean;
  setTab: (tab: JobsTab) => void;
  toggleStar: (job: JobListing) => void;
  setPaste: (changes: Partial<PastedJob>) => void;
  addPasted: () => void;
  setForm: (changes: Partial<SearchForm>) => void;
  search: () => void;
  nextPage: () => void;
  select: (id: string | null) => void;
  summarize: () => void;
  apply: () => void;
  saveOnly: () => void;
}

function readSaved(): SearchForm {
  try {
    const saved = JSON.parse(localStorage.getItem(SEARCH_KEY) ?? "null");
    if (saved && typeof saved.q === "string") return saved;
  } catch {
    // nothing saved, or storage blocked
  }
  return { q: "Software engineer", location: "", graduate: true };
}

export function useFindJobsViewModel(): FindJobsViewModel {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setFormState] = useState<SearchForm>(readSaved);
  const [submitted, setSubmitted] = useState<(SearchForm & { page: number }) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<JobsTab>("results");
  const [paste, setPasteState] = useState<PastedJob>(EMPTY_PASTE);
  const shortlistQuery = useQuery({ queryKey: ["jobs", "shortlist"], queryFn: getShortlist });

  const starMutation = useMutation({
    mutationFn: (job: JobListing) =>
      job.shortlisted ? removeFromShortlist(job.id) : addToShortlist(job.id),
    onSuccess: (_result, job) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(job.shortlisted ? "Removed from your shortlist." : "Added to your shortlist.");
    },
    onError: (e) => setError(errorText(e)),
  });

  const pasteMutation = useMutation({
    mutationFn: () => addPastedJob(paste),
    onSuccess: (application) => {
      setError(null);
      setPasteState(EMPTY_PASTE);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(`${application.role} at ${application.company} added to your tracker.`);
      navigate(`/applications/${application.id}/apply`);
    },
    onError: (e) => setError(errorText(e)),
  });

  const searchQuery = useQuery({
    queryKey: ["jobs", "search", submitted],
    queryFn: () => searchJobs(submitted!),
    enabled: submitted !== null,
    staleTime: 5 * 60_000,
  });
  const detailsQuery = useQuery({
    queryKey: ["jobs", "details", selectedId],
    queryFn: () => getJobDetails(selectedId!),
    enabled: selectedId !== null,
    staleTime: 10 * 60_000,
  });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });

  const summarizeMutation = useMutation({
    mutationFn: (id: string) => summarizeJob(id),
    onSuccess: (details) => {
      setError(null);
      queryClient.setQueryData(["jobs", "details", details.id], details);
    },
    onError: (e) => setError(errorText(e)),
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) => saveJob(id),
    onError: (e) => setError(errorText(e)),
  });

  // Opening a job summarises it once (one AI call per job, only when AI is set up).
  const summarized = useRef(new Set<string>());
  const details = detailsQuery.data;
  const aiConfigured = healthQuery.data?.ai_configured ?? false;
  const { mutate: runSummary } = summarizeMutation;
  useEffect(() => {
    if (details && !details.summary && aiConfigured && !summarized.current.has(details.id)) {
      summarized.current.add(details.id);
      runSummary(details.id);
    }
  }, [details, aiConfigured, runSummary]);

  const save = (then: (applicationId: number) => void) => {
    if (!selectedId) return;
    saveMutation.mutate(selectedId, {
      onSuccess: (application) => {
        setError(null);
        void queryClient.invalidateQueries({ queryKey: ["applications"] });
        void queryClient.invalidateQueries({ queryKey: ["jobs", "search"] });
        then(application.id);
      },
    });
  };

  return {
    form,
    submitted,
    result: searchQuery.data ?? null,
    isSearching: searchQuery.isFetching,
    selectedId,
    details: detailsQuery.data ?? null,
    isLoadingDetails: detailsQuery.isPending && selectedId !== null,
    aiConfigured: healthQuery.data?.ai_configured ?? false,
    isSummarizing: summarizeMutation.isPending,
    isSaving: saveMutation.isPending,
    error:
      error ??
      (searchQuery.error ? errorText(searchQuery.error) : null) ??
      (detailsQuery.error ? errorText(detailsQuery.error) : null),
    tab,
    shortlist: shortlistQuery.data ?? [],
    paste,
    isPasting: pasteMutation.isPending,
    setTab: (next) => {
      setTab(next);
      setSelectedId(null);
    },
    toggleStar: (job) => starMutation.mutate(job),
    setPaste: (changes) => setPasteState((p) => ({ ...p, ...changes })),
    addPasted: () => {
      if (paste.text.trim().length < 20) {
        setError("Paste the job ad's text (at least a couple of sentences).");
        return;
      }
      pasteMutation.mutate();
    },
    setForm: (changes) => setFormState((f) => ({ ...f, ...changes })),
    search: () => {
      if (form.q.trim().length < 2) {
        setError("Type a job title or keyword to search for.");
        return;
      }
      setError(null);
      setSelectedId(null);
      setTab("results");
      setSubmitted({ ...form, page: 1 });
      try {
        localStorage.setItem(SEARCH_KEY, JSON.stringify(form));
      } catch {
        // not remembered
      }
    },
    nextPage: () => submitted && setSubmitted({ ...submitted, page: submitted.page + 1 }),
    select: (id) => {
      setError(null);
      setSelectedId(id);
    },
    summarize: () => selectedId && summarizeMutation.mutate(selectedId),
    // Saves the job to the tracker, then opens the apply page (tailored CV + letter).
    apply: () => save((id) => navigate(`/applications/${id}/apply`)),
    saveOnly: () => save(() => undefined),
  };
}
