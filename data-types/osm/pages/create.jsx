import React from 'react';
import { useNavigate } from 'react-router';
import { DatasetsContext } from '../../../src/dms/packages/dms/src/patterns/datasets/context';
import { getExternalEnv } from '../../../src/dms/packages/dms/src/patterns/datasets/utils/datasources';

export default function Create({ source }) {
  const navigate = useNavigate();
  const { datasources, baseUrl, DAMA_HOST, user, UI } = React.useContext(DatasetsContext);
  const pgEnv = getExternalEnv(datasources);
  const { Button } = UI;
  const sourceName = source?.name || '';
  const sourceId = source?.source_id || source?.id || null;

  const [file, setFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const uploadOSMFile = React.useCallback(async () => {
    if (!file || !sourceName || !pgEnv || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', sourceName);
      formData.append('type', 'gis_dataset');
      formData.append('categories', JSON.stringify([['OSM']]));
      if (sourceId != null) {
        formData.append('source_id', String(sourceId));
      }
      formData.append('file.size', String(file.size || 0));
      if (user?.id != null) {
        formData.append('user.id', String(user.id));
      }
      formData.append('file', file);

      const res = await fetch(`${DAMA_HOST}/dama-admin/${pgEnv}/osm/upload`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || json?.message || 'OSM upload failed');
      }
      if (!json?.source_id) {
        throw new Error('OSM upload did not return a source id');
      }

      navigate(`${baseUrl}/source/${sourceId || json.source_id}`);
    } catch (e) {
      setError(e?.message || 'OSM upload failed');
      setSubmitting(false);
    }
  }, [DAMA_HOST, baseUrl, file, navigate, pgEnv, sourceId, sourceName, submitting, user?.id]);

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="text-sm text-gray-600">
        Upload a `.pbf` file directly, or a `.zip` file that contains a `.pbf`.
      </div>
      <input
        type="file"
        accept=".pbf,.zip,application/zip"
        className="rounded border border-gray-300 bg-white px-3 py-2"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <div className="flex gap-2">
        <Button disabled={!file || !sourceName || submitting} onClick={uploadOSMFile}>
          {submitting ? 'Uploading...' : 'Upload OSM'}
        </Button>
      </div>
    </div>
  );
}
