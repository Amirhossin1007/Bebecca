import { describe, expect, it } from "vitest";
import { AdminRole, AdminTrafficLimitMode } from "types/Admin";
import { isUserManagementLocked } from "./adminTraffic";

const serviceLimit = {
	service_id: 7,
	traffic_limit_mode: AdminTrafficLimitMode.UsedTraffic,
	data_limit: 100,
	created_traffic: 0,
	used_traffic: 100,
	lifetime_used_traffic: 100,
	show_user_traffic: true,
	users_limit: null,
	delete_user_usage_limit_enabled: false,
	delete_user_usage_limit: null,
	deleted_users_usage: 0,
};

describe("isUserManagementLocked", () => {
	it("locks only the exhausted service for both traffic modes", () => {
		const admin = {
			role: AdminRole.Standard,
			use_service_traffic_limits: true,
			service_limits: [
				serviceLimit,
				{
					...serviceLimit,
					service_id: 8,
					traffic_limit_mode: AdminTrafficLimitMode.CreatedTraffic,
					created_traffic: 99,
					used_traffic: 1000,
				},
			],
		};

		expect(isUserManagementLocked(admin, 7)).toBe(true);
		expect(isUserManagementLocked(admin, 8)).toBe(false);
		admin.service_limits[1].created_traffic = 100;
		expect(isUserManagementLocked(admin, 8)).toBe(true);
		expect(isUserManagementLocked(admin, 9)).toBe(false);
	});
});
