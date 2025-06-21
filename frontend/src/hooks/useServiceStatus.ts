import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';

export interface Service {
  id?: number;
  name: string;
  status: string;
}

export const useServiceStatus = (enabled: boolean) =>
  useQuery<Service[]>({
    queryKey: ['serviceStatus'],
    queryFn: () => dashboardService.getServiceStatus(),
    enabled,
    retry: 1,
  });

export default useServiceStatus;
