import { FC, useState, useEffect, ChangeEventHandler } from "react";
import { useAuth } from "../../services/auth";
import {
  getExperimentQuery,
  getPageviewsQuery,
  getUsersQuery,
} from "../../services/datasources";
import track from "../../services/track";
import Modal from "../Modal";
import TextareaAutosize from "react-textarea-autosize";
import { PostgresConnectionParams } from "back-end/types/integrations/postgres";
import { DataSourceInterfaceWithParams } from "back-end/types/datasource";

const EditDataSourceSettingsForm: FC<{
  data: Partial<DataSourceInterfaceWithParams>;
  source: string;
  onCancel: () => void;
  onSuccess: () => void;
}> = ({ data, onSuccess, onCancel, source }) => {
  const [dirty, setDirty] = useState(false);
  const [datasource, setDatasource] = useState<
    Partial<DataSourceInterfaceWithParams>
  >(null);

  useEffect(() => {
    track("View Datasource Settings Form", {
      source,
    });
  }, [source]);

  const { apiCall } = useAuth();
  useEffect(() => {
    if (data && !dirty) {
      const newValue: Partial<DataSourceInterfaceWithParams> = {
        ...data,
        settings: {
          queries: {
            usersQuery: getUsersQuery(
              data.settings,
              (data.params as PostgresConnectionParams)?.defaultSchema
            ),
            experimentsQuery: getExperimentQuery(
              data.settings,
              (data.params as PostgresConnectionParams)?.defaultSchema
            ),
            pageviewsQuery: getPageviewsQuery(
              data.settings,
              (data.params as PostgresConnectionParams)?.defaultSchema
            ),
          },
          events: {
            experimentEvent: "",
            experimentIdProperty: "",
            variationIdProperty: "",
            pageviewEvent: "",
            urlProperty: "",
            userAgentProperty: "",
            ...data?.settings?.events,
          },
          variationIdFormat:
            data?.settings?.variationIdFormat ||
            data?.settings?.experiments?.variationFormat ||
            "index",
        },
      };
      setDatasource(newValue);
    }
  }, [data]);

  if (!datasource) {
    return null;
  }

  const handleSubmit = async () => {
    if (!dirty) return;

    // Update
    await apiCall(`/datasource/${data.id}`, {
      method: "PUT",
      body: JSON.stringify(datasource),
    });

    track("Edit Data Source Queries", {
      type: data.type,
      source,
    });

    setDirty(false);
    onSuccess();
  };
  const setSettings = (
    settings: { [key: string]: string },
    key: "queries" | "events"
  ) => {
    const newVal = {
      ...datasource,
      settings: {
        ...datasource?.settings,
        [key]: {
          ...datasource?.settings[key],
          ...settings,
        },
      },
    };

    setDatasource(newVal as Partial<DataSourceInterfaceWithParams>);
    setDirty(true);
  };
  const onSettingsChange: (
    key: "events" | "queries"
  ) => ChangeEventHandler<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  > = (key) => (e) => {
    setSettings({ [e.target.name]: e.target.value }, key);
  };
  const settingsSupported = !["google_analytics"].includes(datasource.type);

  return (
    <Modal
      open={true}
      submit={handleSubmit}
      close={onCancel}
      size="lg"
      header={"Edit Queries"}
      cta="Save"
    >
      {datasource.type === "mixpanel" && (
        <div>
          <h4>Experiments</h4>
          <div className="form-group">
            <label>View Experiment Event</label>
            <input
              type="text"
              className="form-control"
              name="experimentEvent"
              onChange={onSettingsChange("events")}
              placeholder="$experiment_started"
              value={datasource.settings?.events?.experimentEvent || ""}
            />
          </div>
          <div className="form-group">
            <label>Experiment Id Property</label>
            <input
              type="text"
              className="form-control"
              name="experimentIdProperty"
              onChange={onSettingsChange("events")}
              placeholder="Experiment name"
              value={datasource.settings?.events?.experimentIdProperty || ""}
            />
          </div>

          <div className="form-group">
            <label>Variation Id Property</label>
            <input
              type="text"
              className="form-control"
              name="variationIdProperty"
              onChange={onSettingsChange("events")}
              placeholder="Variant name"
              value={datasource.settings?.events?.variationIdProperty}
            />
          </div>

          <div className="form-group">
            <label>Variation Id Format</label>
            <select
              className="form-control"
              name="variationFormat"
              onChange={(e) => {
                setDatasource({
                  ...datasource,
                  settings: {
                    ...datasource.settings,
                    variationIdFormat: e.target.value as "index" | "key",
                  },
                });
                setDirty(true);
              }}
              required
              value={datasource.settings?.variationIdFormat || "index"}
            >
              <option value="index">(0=control, 1=1st variation, ...)</option>
              <option value="key">Unique String Keys</option>
            </select>
          </div>
          <hr />
          <h4>Page Views</h4>
          <div className="form-group">
            <label>Page Views Event</label>
            <input
              type="text"
              className="form-control"
              name="pageviewEvent"
              placeholder="Page view"
              onChange={onSettingsChange("events")}
              value={datasource.settings?.events?.pageviewEvent || ""}
            />
          </div>
          <div className="form-group">
            <label>URL Path Property</label>
            <input
              type="text"
              className="form-control"
              name="urlProperty"
              placeholder="path"
              onChange={onSettingsChange("events")}
              value={datasource.settings?.events?.urlProperty || ""}
            />
          </div>
          <div className="form-group">
            <label>User Agent Property</label>
            <input
              type="text"
              className="form-control"
              name="userAgentProperty"
              placeholder="user_agent"
              onChange={onSettingsChange("events")}
              value={datasource.settings?.events?.userAgentProperty || ""}
            />
          </div>
        </div>
      )}
      {settingsSupported && datasource.type !== "mixpanel" && (
        <div>
          <div
            className="row py-2 mb-3 align-items-center bg-light border-bottom"
            style={{ marginTop: "-1rem" }}
          >
            <div className="col-auto">Quick Presets:</div>
            <div className="col-auto">
              <button
                className="btn btn-outline-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  setDatasource({
                    ...datasource,
                    settings: {
                      ...datasource.settings,
                      queries: {
                        experimentsQuery: `SELECT
  user_id,
  anonymous_id,
  received_at as timestamp,
  experiment_id,
  variation_id,
  context_page_path as url,
  context_user_agent as user_agent
FROM
  experiment_viewed`,
                        pageviewsQuery: `SELECT
  user_id,
  anonymous_id,
  received_at as timestamp,
  path as url,
  context_user_agent as user_agent
FROM
  pages`,
                        usersQuery: `SELECT
  user_id,
  anonymous_id
FROM
  identifies`,
                      },
                    },
                  });
                  setDirty(true);
                }}
              >
                Segment
              </button>
            </div>
          </div>
          <div className="row mb-3">
            <div className="col">
              <div className="form-group">
                <label className="font-weight-bold">Experiments SQL</label>
                <TextareaAutosize
                  required
                  className="form-control"
                  name="experimentsQuery"
                  onChange={onSettingsChange("queries")}
                  value={datasource.settings?.queries?.experimentsQuery}
                  minRows={10}
                  maxRows={20}
                />
                <small className="form-text text-muted">
                  Used to pull experiment results.
                </small>
              </div>
            </div>
            <div className="col-md-5 col-lg-4">
              <div className="pt-md-4">
                One row per user/experiment/variation. Required column names:
              </div>
              <ul>
                <li>
                  <code>user_id</code>
                </li>
                <li>
                  <code>anonymous_id</code>
                </li>
                <li>
                  <code>timestamp</code>
                </li>
                <li>
                  <code>experiment_id</code>
                </li>
                <li>
                  <code>variation_id</code>
                </li>
                <li>
                  <code>url</code>
                </li>
                <li>
                  <code>user_agent</code>
                </li>
              </ul>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col">
              <div className="form-group">
                <label className="font-weight-bold">Variation Id Format</label>
                <select
                  className="form-control"
                  name="variationFormat"
                  onChange={(e) => {
                    setDatasource({
                      ...datasource,
                      settings: {
                        ...datasource.settings,
                        variationIdFormat: e.target.value as "index" | "key",
                      },
                    });
                    setDirty(true);
                  }}
                  required
                  value={datasource.settings?.variationIdFormat || "index"}
                >
                  <option value="index">Array Index</option>
                  <option value="key">String Keys</option>
                </select>
              </div>
            </div>
            <div className="col-md-5 col-lg-4">
              <div className="pt-md-3">
                <p>
                  <strong>Array Index</strong> means the ids are numeric
                  (control is <code>0</code>, the 1st variation is{" "}
                  <code>1</code>, etc.).
                </p>
                <p>
                  <strong>String Keys</strong> means the ids are custom strings
                  (e.g. <code>control</code> or <code>blue-buttons</code>).
                </p>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col">
              <div className="form-group">
                <label className="font-weight-bold">Users SQL</label>
                <TextareaAutosize
                  required
                  className="form-control"
                  name="usersQuery"
                  onChange={onSettingsChange("queries")}
                  value={datasource.settings?.queries?.usersQuery}
                  minRows={5}
                  maxRows={20}
                />
                <small className="form-text text-muted">
                  Used to join users to anonymous sessions before they logged
                  in.
                </small>
              </div>
            </div>
            <div className="col-md-5 col-lg-4">
              <div className="pt-md-4">
                One row per user/anonymous_id. Required column names:
              </div>
              <ul>
                <li>
                  <code>user_id</code>
                </li>
                <li>
                  <code>anonymous_id</code>
                </li>
              </ul>
            </div>
          </div>

          <div className="row">
            <div className="col">
              <div className="form-group">
                <label className="font-weight-bold">Pageviews SQL</label>
                <TextareaAutosize
                  required
                  className="form-control"
                  name="pageviewsQuery"
                  onChange={onSettingsChange("queries")}
                  value={datasource.settings?.queries?.pageviewsQuery}
                  minRows={8}
                  maxRows={20}
                />
                <small className="form-text text-muted">
                  Used to predict running time before an experiment starts.
                </small>
              </div>
            </div>
            <div className="col-md-5 col-lg-4">
              <div className="pt-md-4">
                One row per page view. Required column names:
              </div>
              <ul>
                <li>
                  <code>user_id</code>
                </li>
                <li>
                  <code>anonymous_id</code>
                </li>
                <li>
                  <code>timestamp</code>
                </li>
                <li>
                  <code>url</code>
                </li>
                <li>
                  <code>user_agent</code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default EditDataSourceSettingsForm;
