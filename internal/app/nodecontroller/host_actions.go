package nodecontroller

import (
	"context"
	"fmt"
	"strings"
	"time"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func (c Controller) UpdateRuntime(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "update_runtime", req, func(queued Request) error {
		result, err = c.updateRuntimeNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) UpdateGeo(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "update_geo", req, func(queued Request) error {
		result, err = c.updateGeoNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) RestartService(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "restart_service", req, func(queued Request) error {
		result, err = c.restartServiceNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) UpdateService(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "update_service", req, func(queued Request) error {
		result, err = c.updateServiceNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) RebootHost(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "reboot_host", req, func(queued Request) error {
		result, err = c.rebootHostNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) ApplyTorProxy(ctx context.Context, req Request) (result RuntimeResult, err error) {
	err = c.runDurableCommand(ctx, "apply_tor_proxy", req, func(queued Request) error {
		result, err = c.applyTorProxyNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) ConfigureWindscribe(ctx context.Context, req Request) (result WindscribeResult, err error) {
	err = c.runDurableCommand(ctx, "configure_windscribe", req, func(queued Request) error {
		result, err = c.configureWindscribeNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) ConfigurePsiphon(ctx context.Context, req Request) (result PsiphonResult, err error) {
	err = c.runDurableCommand(ctx, "configure_psiphon", req, func(queued Request) error {
		result, err = c.configurePsiphonNow(ctx, queued)
		return err
	})
	return
}

func (c Controller) runDurableCommand(ctx context.Context, operationType string, req Request, apply func(Request) error) error {
	operation, err := c.repo.QueueCommand(ctx, operationType, req.NodeID, req)
	if err != nil {
		return err
	}
	claimed, err := c.repo.MarkOperationRunning(ctx, operation.ID)
	if err != nil {
		return err
	}
	if !claimed {
		err := fmt.Errorf("node operation could not be claimed")
		_ = c.repo.MarkOperationFailed(context.WithoutCancel(ctx), operation.ID, err.Error())
		return err
	}
	req.OperationID = fmt.Sprintf("%s-%d", operationType, operation.ID)
	if err := apply(req); err != nil {
		statusCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if isPermanentOperationError(err) {
			_ = c.repo.MarkOperationFailed(statusCtx, operation.ID, err.Error())
		} else {
			_ = c.repo.MarkOperationRetrying(statusCtx, operation.ID, err.Error())
		}
		return err
	}
	statusCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	return c.repo.MarkOperationDone(statusCtx, operation.ID)
}

func (c Controller) updateRuntimeNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update runtime", req.NodeID, err)
	}
	res, err := client.Runtime().UpdateRuntime(ctx, &nodev1.RuntimeUpdateRequest{
		OperationId: req.OperationID,
		Version:     strings.TrimSpace(req.Version),
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update runtime", req.NodeID, err)
	}
	return c.finishRuntime(ctx, node, res.GetRuntime(), res.GetMessage())
}

func (c Controller) updateGeoNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update geo", req.NodeID, err)
	}
	files := make([]*nodev1.GeoFile, 0, len(req.Files))
	for _, file := range req.Files {
		files = append(files, &nodev1.GeoFile{Name: file.Name, Url: file.URL})
	}
	res, err := client.Runtime().UpdateGeo(ctx, &nodev1.GeoUpdateRequest{
		OperationId: req.OperationID,
		Files:       files,
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update geo", req.NodeID, err)
	}
	return c.finishRuntime(ctx, node, res.GetRuntime(), res.GetMessage())
}

func (c Controller) restartServiceNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("restart service", req.NodeID, err)
	}
	res, err := client.Runtime().RestartService(ctx, &nodev1.ServiceRestartRequest{
		OperationId: req.OperationID,
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("restart service", req.NodeID, err)
	}
	return runtimeResult(node, res.GetRuntime(), nil), nil
}

func (c Controller) updateServiceNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update service", req.NodeID, err)
	}
	res, err := client.Runtime().UpdateService(ctx, &nodev1.ServiceUpdateRequest{
		OperationId: req.OperationID,
		Channel:     strings.TrimSpace(req.Channel),
		Version:     strings.TrimSpace(req.Version),
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("update service", req.NodeID, err)
	}
	if res == nil {
		return RuntimeResult{}, fmt.Errorf("node %d update service returned no response", req.NodeID)
	}
	return runtimeResult(node, res.GetRuntime(), nil), nil
}

func (c Controller) rebootHostNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("reboot host", req.NodeID, err)
	}
	res, err := client.Runtime().RebootHost(ctx, &nodev1.HostRebootRequest{
		OperationId: req.OperationID,
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("reboot host", req.NodeID, err)
	}
	return runtimeResult(node, res.GetRuntime(), nil), nil
}

func (c Controller) applyTorProxyNow(ctx context.Context, req Request) (RuntimeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("apply tor proxy", req.NodeID, err)
	}
	res, err := client.Runtime().ApplyTorProxy(ctx, &nodev1.TorProxyRequest{
		OperationId: req.OperationID,
		SocksPort:   req.TorSocksPort,
		ExitCountry: strings.TrimSpace(req.TorExitCountry),
		StrictExit:  req.TorStrictExit,
	})
	if err != nil {
		_ = c.repo.SetError(ctx, req.NodeID, err.Error())
		return RuntimeResult{}, friendlyNodeError("apply tor proxy", req.NodeID, err)
	}
	return runtimeResult(node, res.GetRuntime(), nil), nil
}

func (c Controller) configureWindscribeNow(ctx context.Context, req Request) (WindscribeResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		return WindscribeResult{}, friendlyNodeError("configure Windscribe", req.NodeID, err)
	}
	res, err := client.Runtime().ConfigureWindscribe(ctx, &nodev1.WindscribeProxyRequest{
		OperationId:   req.OperationID,
		Action:        strings.TrimSpace(req.WindscribeAction),
		Username:      strings.TrimSpace(req.WindscribeUsername),
		Password:      req.WindscribePassword,
		Location:      strings.TrimSpace(req.WindscribeLocation),
		SocksPort:     req.WindscribeSocksPort,
		ProxyUsername: req.WindscribeProxyUsername,
		ProxyPassword: req.WindscribeProxyPassword,
	})
	if err != nil {
		return WindscribeResult{}, friendlyNodeError("configure Windscribe", req.NodeID, err)
	}
	locations := make([]WindscribeLocation, 0, len(res.GetLocations()))
	for _, location := range res.GetLocations() {
		locations = append(locations, WindscribeLocation{
			Name:      location.GetName(),
			Available: location.GetAvailable(),
		})
	}
	return WindscribeResult{
		Runtime:   runtimeResult(node, res.GetRuntime(), nil),
		Locations: locations,
	}, nil
}

func (c Controller) configurePsiphonNow(ctx context.Context, req Request) (PsiphonResult, error) {
	client, node, err := c.dial(ctx, req.NodeID)
	if err != nil {
		return PsiphonResult{}, friendlyNodeError("configure Psiphon", req.NodeID, err)
	}
	res, err := client.Runtime().ConfigurePsiphon(ctx, &nodev1.PsiphonProxyRequest{
		OperationId: req.OperationID,
		ConfigJson:  req.PsiphonConfigJSON,
		Action:      req.PsiphonAction,
		Locations:   req.PsiphonLocations,
		SocksPort:   req.PsiphonSocksPort,
	})
	if err != nil {
		return PsiphonResult{}, friendlyNodeError("configure Psiphon", req.NodeID, err)
	}
	instances := make([]PsiphonInstance, 0, len(res.GetInstances()))
	for _, instance := range res.GetInstances() {
		instances = append(instances, PsiphonInstance{
			Location:  instance.GetLocation(),
			SocksPort: instance.GetSocksPort(),
		})
	}
	return PsiphonResult{
		Runtime:   runtimeResult(node, res.GetRuntime(), nil),
		Instances: instances,
		Locations: res.GetLocations(),
	}, nil
}
