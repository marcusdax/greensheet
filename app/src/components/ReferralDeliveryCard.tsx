const getStatusText = (status: ModuleStatus) => {
  const labels: Record<ModuleStatus, string> = { available: 'Not started', in_progress: 'In progress', completed: 'Completed', locked: 'Locked' };
  return t(`curriculum.progress.${status}`, labels[status]);
};