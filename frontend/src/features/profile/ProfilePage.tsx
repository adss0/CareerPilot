// Connects the ViewModel to the View.
import { ProfileView } from "./ProfileView";
import { useProfileViewModel } from "./useProfileViewModel";

export function ProfilePage() {
  const vm = useProfileViewModel();
  return <ProfileView {...vm} />;
}
