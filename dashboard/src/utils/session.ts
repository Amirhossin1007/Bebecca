import { clearAdminsCache } from "contexts/AdminsContext";
import { clearDashboardCache } from "contexts/DashboardContext";
import { clearHostsCache } from "contexts/HostsContext";
import { clearServicesCache } from "contexts/ServicesContext";
import { queryClient } from "utils/react-query";
import { useAPIRequestErrors } from "service/http";

export const clearClientSession = () => {
	useAPIRequestErrors.getState().clear();
	localStorage.removeItem("token");
	queryClient.clear();
	clearAdminsCache();
	clearDashboardCache();
	clearServicesCache();
	clearHostsCache();
};
