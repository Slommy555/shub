import { Alert } from 'react-native';
import { useSegments } from 'expo-router';
import { DraggableFab, type FabAction } from './DraggableFab';
import { useSheets } from '../../lib/sheets';
import { useChrome } from '../../lib/chrome';

/**
 * The single floating plus button, rendered once at the tab-group root. It reads
 * the active tab from the router segments and offers that tab's add action.
 * Tasks keeps the speed-dial (Add / Voice / Hide bar); every other tab opens its
 * add sheet directly on tap. Hidden on Voice and Settings.
 */
export function GlobalFab() {
  const segments = useSegments();
  const tab = segments[segments.length - 1];
  const { openSheet } = useSheets();
  const { tabBarHidden, toggleTabBar } = useChrome();

  let actions: FabAction[] | null = null;
  switch (tab) {
    case 'tasks':
      actions = [
        { icon: 'add', label: 'Add task', onPress: () => openSheet('task') },
        {
          icon: 'mic-outline',
          label: 'Voice',
          onPress: () => Alert.alert('Voice', 'Voice capture is coming soon on the phone.'),
        },
        {
          icon: tabBarHidden ? 'chevron-up' : 'chevron-down',
          label: tabBarHidden ? 'Show menu bar' : 'Hide menu bar',
          onPress: toggleTabBar,
        },
      ];
      break;
    case 'schedule':
      actions = [{ icon: 'calendar-outline', label: 'Add event', onPress: () => openSheet('event') }];
      break;
    case 'habits':
      actions = [{ icon: 'repeat-outline', label: 'Add habit', onPress: () => openSheet('habit') }];
      break;
    case 'notes':
      actions = [{ icon: 'document-text-outline', label: 'Add note', onPress: () => openSheet('note') }];
      break;
    case 'workout':
      actions = [{ icon: 'barbell-outline', label: 'Start workout', onPress: () => openSheet('workout') }];
      break;
    case 'budget':
      actions = [{ icon: 'card-outline', label: 'Add transaction', onPress: () => openSheet('transaction') }];
      break;
    default:
      return null; // voice (mic serves this), settings, etc.
  }

  return <DraggableFab actions={actions} />;
}
