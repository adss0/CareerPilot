// Connects the ViewModel to the View.
import { useParams } from "react-router-dom";

import { ApplyView } from "./ApplyView";
import { useApplyViewModel } from "./useApplyViewModel";

export function ApplyPage() {
  const { id } = useParams();
  const vm = useApplyViewModel(Number(id));
  return <ApplyView {...vm} />;
}
