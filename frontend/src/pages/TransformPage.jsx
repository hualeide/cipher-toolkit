import { useCallback } from 'react';

import { useApp } from '../context/AppContext.jsx';

import { useSettings } from '../hooks/useSettings.js';

import CipherPicker from '../components/CipherPicker.jsx';

import CipherWorkbench from '../components/CipherWorkbench.jsx';

import BatchTransformPanel from '../components/BatchTransformPanel.jsx';

import TransformHistoryPanel from '../components/TransformHistoryPanel.jsx';

import { useCipherBidirectional } from '../hooks/useCipherBidirectional.js';



export default function TransformPage() {

  const { selected, transformPrefill, consumeTransformPrefill, t } = useApp();

  const { settings, addHistory } = useSettings();

  const onPrefillConsumed = useCallback(() => consumeTransformPrefill(), [consumeTransformPrefill]);

  const wb = useCipherBidirectional(selected, settings, t, transformPrefill, onPrefillConsumed, addHistory);



  return (

    <div className="page-layout">

      <aside className="panel sidebar"><CipherPicker /></aside>

      <div className="page-main-stack">

        <CipherWorkbench

          mode="bidirectional"

          selected={selected}

          params={wb.params}

          onParamChange={wb.onParamChange}

          plain={wb.plain}

          cipher={wb.cipher}

          onPlainChange={wb.onPlainChange}

          onCipherChange={wb.onCipherChange}

          error={wb.error}

          busy={wb.busy}

          autoTransform={settings.autoTransform}

          onRun={wb.run}

        />

        <BatchTransformPanel selected={selected} params={wb.params} />

        <TransformHistoryPanel />

      </div>

    </div>

  );

}


