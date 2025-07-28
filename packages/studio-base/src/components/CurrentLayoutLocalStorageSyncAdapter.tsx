// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import assert from "assert";
import { useEffect } from "react";
import { useDebounce } from "use-debounce";

import Log from "@foxglove/log";
import { LOCAL_STORAGE_STUDIO_LAYOUT_KEY } from "@foxglove/studio-base/constants/localStorageKeys";
import {
  LayoutState,
  SelectedLayout,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { defaultLayout } from "@foxglove/studio-base/providers/CurrentLayoutProvider/defaultLayout";
import { migratePanelsState } from "@foxglove/studio-base/services/migrateLayout";
import { LAYOUT } from "@foxglove/studio-base/constants/layout";
import { diagnostics } from "@foxglove/studio-base/layouts/diagnostics";
import { visualization } from "@foxglove/studio-base/layouts/visualization";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";

function selectLayoutData(state: LayoutState) {
  return state.selectedLayout?.data;
}

function onMessageHandler(event: MessageEvent, setCurrentLayout: (newLayout: SelectedLayout | undefined) => void, sidebarActions: any) {
  const { type, layout } = event.data;
  if (type === "updateLayout") {
    if (layout === LAYOUT.DIAGNOSTICS || layout === LAYOUT.VISUALIZATION) {
      const layoutData = layout === LAYOUT.DIAGNOSTICS ? diagnostics : visualization;
      const serializedLayoutData = JSON.stringify(layoutData);
      assert(serializedLayoutData);
      localStorage.setItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY, serializedLayoutData);

      const data = migratePanelsState((layoutData as LayoutData) || defaultLayout);
      setCurrentLayout({ data });

      sidebarActions.left.setOpen(layout === LAYOUT.VISUALIZATION);
    }
  }
};

const log = Log.getLogger(__filename);

export function CurrentLayoutLocalStorageSyncAdapter(): JSX.Element {
  const { selectedSource } = usePlayerSelection();
  const { sidebarActions } = useWorkspaceActions();

  const { setCurrentLayout } = useCurrentLayoutActions();
  const currentLayoutData = useCurrentLayoutSelector(selectLayoutData);

  useEffect(() => {
    if (selectedSource?.sampleLayout) {
      setCurrentLayout({ data: selectedSource.sampleLayout });
    }
  }, [selectedSource, setCurrentLayout]);

  const [debouncedLayoutData] = useDebounce(currentLayoutData, 250, { maxWait: 500 });

  useEffect(() => {
    if (!debouncedLayoutData) {
      return;
    }

    const serializedLayoutData = JSON.stringify(debouncedLayoutData);
    assert(serializedLayoutData);
    localStorage.setItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY, serializedLayoutData);
  }, [debouncedLayoutData]);

  useEffect(() => {
    window.addEventListener("message", (event: MessageEvent) => onMessageHandler(event, setCurrentLayout, sidebarActions));

    return () => {
      window.removeEventListener("message", (event: MessageEvent) => onMessageHandler(event, setCurrentLayout, sidebarActions));
    };
  }, [setCurrentLayout, sidebarActions]);

  useEffect(() => {
    log.debug(`Reading layout from local storage: ${LOCAL_STORAGE_STUDIO_LAYOUT_KEY}`);

    const serializedLayoutData = localStorage.getItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY);

    if (serializedLayoutData) {
      log.debug("Restoring layout from local storage");
    } else {
      log.debug("No layout found in local storage. Using default layout.");
    }

    const layoutData = migratePanelsState(
      serializedLayoutData ? (JSON.parse(serializedLayoutData) as LayoutData) : defaultLayout,
    );
    setCurrentLayout({ data: layoutData });
  }, [setCurrentLayout]);

  return <></>;
}
