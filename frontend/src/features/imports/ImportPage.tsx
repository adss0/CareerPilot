// Connects the ViewModel to the View.
import { ImportView } from "./ImportView";
import { useImportViewModel } from "./useImportViewModel";

export function ImportPage() {
  const vm = useImportViewModel();
  return <ImportView {...vm} />;
}
