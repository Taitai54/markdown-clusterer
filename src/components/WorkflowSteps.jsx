const STEPS = [
  { id: 'import', label: 'Import' },
  { id: 'group', label: 'Group' },
  { id: 'folders', label: 'Folder export' },
];

const DETAIL = {
  import: 'This only reads files. They stay in their current folders.',
  group: 'Groups live on screen until you export. Tick files and choose Combine into one file if you want their text in a single new markdown file. That writes a new file and does not move the originals.',
  folders: 'Folder export is the step that writes to disk. Copy leaves each original where it is. Move takes each file out of its current folder and puts it in a folder named after its group. Every file stays a separate file.',
};

export default function WorkflowSteps({ step }) {
  const current = STEPS.findIndex(item => item.id === step);

  return (
    <div className="mb-4 rounded-lg border border-gray-700 bg-dark-100 px-4 py-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Workflow">
        {STEPS.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2" aria-current={item.id === step ? 'step' : undefined}>
            {index > 0 && <span className="text-gray-600" aria-hidden="true">→</span>}
            <span className={item.id === step ? 'font-semibold text-white' : index < current ? 'text-gray-300' : 'text-gray-500'}>
              {index + 1}. {item.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-gray-400">{DETAIL[step]}</p>
    </div>
  );
}
