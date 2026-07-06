import { Redirect } from 'expo-router';

// The signed-in root ("/") sends the user to the Tasks tab.
export default function Index() {
  return <Redirect href="/tasks" />;
}
